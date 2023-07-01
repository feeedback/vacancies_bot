import dayjs from 'dayjs';
import axios from 'axios';
import qs from 'qs';
// import LRU from 'lru-cache';
import _ from 'lodash';
import dotenv from 'dotenv';
import { parseVacanciesFromDom, parseSalaryFromTitleHH } from './dom-parser.js';
import { requestConfig, syntaxSearch as syntax, filterVacanciesSearchBase } from './config.js';
import { delayMs, getHashByStr } from '../utils/utils.js';
import { getCurrencyRates } from '../utils/api_currency.js';

// export const cache = new LRU({
//   max: 1000,
//   maxAge: 1000 * 60 * 60 * 24 * 10, // 10 days
// });
dotenv.config();

const getStringifyVacancy = ({
  title = '',
  tasks = '',
  skills = '',
  link = '',
  salary,
  company = '',
  // schedule = '',
  publicationTimeUnix = '',
  lastChangeTimeUnix = '',
  responsesCount = 0,
  online_users_count: online = 0,
  city = '',
  linkByCity = null,
  ago = '',
}) => {
  const lastEdit = lastChangeTimeUnix ? `${dayjs.unix(+lastChangeTimeUnix).fromNow()}` : ago;
  const agoStr = publicationTimeUnix
    ? `${dayjs.unix(+publicationTimeUnix).fromNow()} (✍️${lastEdit})`
    : `✍️${lastEdit})`;
  const salaryOut = salary.isSalaryDefine ? `${salary.fork} (~${salary.avgUSD} $)` : '_Не указана_';
  const linkB = link.split('hh').join('*hh*').split('://')[1];
  const companyR = company.replace(/[_$*]/g, '-');
  const titleR = title.replace(/[_$*]/g, '-');
  const tasksR = tasks.replace(/[_$*]/g, '-');
  const skillsR = skills.replace(/[_$*]/g, '-');
  const cityR = city.replace(/[_$*]/g, '-');

  const cityWithLinks = !linkByCity
    ? `_${cityR}_`
    : linkByCity.map(([c, l]) => `[${c.replace(/[_$*]/g, '-')}](${l})`).join('; ');
  const counts = online ? `✉️${responsesCount} 👀${online}` : `✉️${responsesCount}`;
  // const scheduleR = schedule.replace(/[_$*]/g, '-');

  // return `${salaryOut} | ${ago} | «${companyR}» | *«${titleR}»* | ${tasksR} ${skillsR} | _${cityR}. ${scheduleR}_ ► ${linkB}`;
  // return `${salaryOut} | ${agoStr} |${counts}| «${companyR}» | *«${titleR}»* | ${tasksR} ${skillsR} | _${cityR}._ ► ${linkB}`;
  return `${salaryOut} | ${agoStr} |${counts}| «${companyR}» | *«${titleR}»* | ${tasksR} ${skillsR} | ${cityWithLinks}. ► ${linkB}`;
};

const getStringifyVacancies = (vacanciesFiltered) => vacanciesFiltered.map(getStringifyVacancy);

const createFilterSearch = (userFilter = {}, userWords = {}, lastRequestTime, isStartDay) => {
  const { excludeWordTitle = [], excludeWordDesc = [], includeWordDesc = [] } = userWords;

  const exTitle = excludeWordTitle.length
    ? syntax.BY_TITLE(syntax.EXCLUDE(syntax.OR(...excludeWordTitle)))
    : '';
  const exDesc = excludeWordDesc.length
    ? syntax.BY_DESC(syntax.EXCLUDE(syntax.OR(...excludeWordDesc)))
    : '';
  const inc = includeWordDesc.length
    ? syntax.BY_ALL(syntax.INCLUDE(syntax.OR(...includeWordDesc)))
    : '';
  const searchText = syntax.ALL(inc, exTitle, exDesc);

  const filterVariable = {
    ...userFilter,
    ...filterVacanciesSearchBase,
    date_from: dayjs
      .unix(lastRequestTime)
      .format(isStartDay ? 'DD.MM.YYYY' : 'DD.MM.YYYY HH:mm:ss'),
    text: searchText,
  };

  return filterVariable;
};

const formatFilterSort = (
  vacanciesRaw,
  baseCurrency = 'RUB',
  rates = { RUB: 80, USD: 1 },
  minSalary = 0,
  maxSalary = Infinity
) => {
  const vacancies = vacanciesRaw
    .map((vacancy) => {
      let salary = { isSalaryDefine: false, avg: null, avgUSD: null, fork: null, forkUSD: null };

      if (vacancy.salaryStr) {
        salary = parseSalaryFromTitleHH(vacancy.salaryStr, baseCurrency, rates);
      }

      return { ...vacancy, salary };
    })
    .filter(
      // ({ schedule, salary: { avg, isSalaryDefine } }) =>
      // schedule !== 'Можно удалённо.' &&
      ({ salary: { avg, isSalaryDefine } }) =>
        !isSalaryDefine || (avg >= minSalary && avg <= maxSalary)
    )
    .sort(
      (
        { salary: { avgUSD: usdA }, publicationTimeUnix: atA },
        { salary: { avgUSD: usdB }, publicationTimeUnix: atB }
      ) =>
        // atB - atA || usdB - usdA
        usdB - usdA || atB - atA
    );

  return vacancies;
};

const requestVacanciesHeadHunter = async (
  userFilter,
  userWords,
  lastRequestTimeRaw = null,
  minSalary = 0,
  maxSalary = Infinity,
  redisCache
) => {
  const rates = await getCurrencyRates();

  let lastRequestTime = lastRequestTimeRaw;
  let isStartDay = false;
  if (!lastRequestTimeRaw) {
    lastRequestTime = dayjs().startOf('day').unix();

    isStartDay = true;
  }
  // let isStartOldDay = false;
  // isStartOldDay = lastRequestTime !== dayjs().startOf('day').unix() && dayjs.unix().format('HH:mm:ss') === '00:00:00';
  // можно добавить что когда запрашивается /get 2,3,... то не отображается текущий день, чтобы можно было сохранять в кэш

  const filter = createFilterSearch(userFilter, userWords, lastRequestTime, isStartDay);
  const urlRaw = new URL(
    `${requestConfig.BASE_URL}?${qs.stringify(filter, { arrayFormat: 'repeat' })}`
  );
  const urlRawJSON = new URL(
    `${requestConfig.BASE_URL_JSON}?${qs.stringify(filter, { arrayFormat: 'repeat' })}`
  );
  const keyCache = getHashByStr(urlRaw.toString());

  if (await redisCache.exists(keyCache)) {
    const cachedVacanciesData = JSON.parse(await redisCache.get(keyCache)).map((vacancy) => ({
      ...vacancy,
      ago: dayjs.unix(vacancy.createdAt).fromNow(),
    }));
    return {
      vacanciesData: cachedVacanciesData,
      getStringifyVacancies,
    };
  }
  console.log('request vacancies HeadHunter', urlRaw.toString());
  console.log('request vacancies HeadHunter JSON', urlRawJSON.toString());

  let page = 0;
  let pageMax = Infinity;
  const vacancies = [];

  while (page < pageMax) {
    urlRaw.searchParams.set('page', page);
    const url = urlRaw.toString();
    urlRawJSON.searchParams.set('page', page);
    const urlJSON = urlRawJSON.toString();

    let vacanciesData = null;
    console.log('--- --- ---> page', page + 1);

    try {
      const res = await axios.get(url, { headers: requestConfig.headers });
      const { vacanciesDataRaw, vacanciesCount } = await parseVacanciesFromDom(
        res.data,
        redisCache
      );
      const resJSON = await axios.get(urlJSON, { headers: requestConfig.headersJson });
      // const res2 = await axios.get(url2, {});

      const mapJsonDataByVacancyId = _.groupBy(
        resJSON.data.vacancySearchResult.vacancies,
        'vacancyId'
      );
      // console.log('mapJsonDataByVacancyId', mapJsonDataByVacancyId);

      const vacanciesDataRawWithJSON = vacanciesDataRaw.map((v) => {
        const rawJson = mapJsonDataByVacancyId[v.id][0];

        return Object.assign(v, {
          responsesCount: rawJson?.responsesCount || 0, // todo: понять чем различается с totalResponsesCount
          online_users_count: rawJson?.online_users_count || 0,
          creationTime: rawJson?.creationTime,
          publicationTime: rawJson?.publicationTime?.$,
          publicationTimeUnix: rawJson?.publicationTime?.['@timestamp'],
          lastChangeTime: rawJson?.lastChangeTime?.$,
          lastChangeTimeUnix: rawJson?.lastChangeTime?.['@timestamp'],
        });
      });
      // console.log('vacanciesDataRaw2 :>> ', vacanciesDataRawWithJSON);

      pageMax = Math.ceil(vacanciesCount / 20);

      vacanciesData = formatFilterSort(
        vacanciesDataRawWithJSON,
        'RUB',
        rates,
        minSalary,
        maxSalary
      );
      vacancies.push(...vacanciesData);

      if (vacanciesData.length === 0) {
        pageMax = 0;
      }
    } catch (error) {
      console.log('error requestVacanciesHeadHunter', error);
      throw error;
    }

    page += 1;

    await delayMs(process.env.DELAY_INTERVAL_HH_REQUEST || 10_000);
  }

  redisCache.set(keyCache, JSON.stringify(vacancies), 'EX', isStartDay ? 60 * 60 * 2 : 60 * 5); // 2 hour // 5 min

  return { vacanciesData: vacancies, getStringifyVacancies };
};
export default requestVacanciesHeadHunter;
