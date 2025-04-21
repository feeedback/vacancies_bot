import axios from 'axios';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
// import LRU from 'lru-cache';
import _ from 'lodash';
import qs from 'qs';
import { getCurrencyRates } from '../utils/api_currency.js';
import { delayMs, getHashByStr } from '../utils/utils.js';
import {
  filterVacanciesSearchBase,
  requestConfig,
  syntaxSearch as syntax,
} from './config.js';
import { parseSalaryFromTitleHH, parseVacanciesFromDom } from './dom-parser.js';

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
  schedule = false,
  publicationTimeUnix = '',
  lastChangeTimeUnix = '',
  responsesCount = 0,
  online_users_count: online = 0,
  city = '',
  linkByCity = null,
  ago = '',
}) => {
  const lastEdit = lastChangeTimeUnix
    ? `${dayjs.unix(+lastChangeTimeUnix).fromNow()}`
    : ago;
  const agoStr = publicationTimeUnix
    ? `${dayjs.unix(+publicationTimeUnix).fromNow()} (✍️${lastEdit})`
    : `✍️${lastEdit})`;
  const salaryOut = salary.isSalaryDefine
    ? `${salary.fork} (~${salary.avgUSD} $)`
    : '_Не указана_';
  const linkB = link.split('hh').join('*hh*').split('://')[1];
  const companyR = company.replace(/[_$*]/g, '-');
  const titleR = title.replace(/[_$*]/g, '-');
  const tasksR = tasks.replace(/[_$*]/g, '-');
  const skillsR = skills.replace(/[_$*]/g, '-');
  const cityR = city.replace(/[_$*]/g, '-');

  const cityWithLinks = !linkByCity
    ? `_${cityR}_`
    : linkByCity
        .map(([c, l]) => `[${c.replace(/[_$*]/g, '-')}](${l})`)
        .join('; ');
  const counts = online
    ? `✉️${responsesCount} 👀${online}`
    : `✉️${responsesCount}`;
  const scheduleR = schedule ? '; _or from_ 🏠' : ''; // 🏠👨‍💻 // ' _Можно удалённо_.'
  // const scheduleR = schedule.replace(/[_$*]/g, '-');

  // return `${salaryOut} | ${ago} | «${companyR}» | *«${titleR}»* | ${tasksR} ${skillsR} | _${cityR}. ${scheduleR}_ ► ${linkB}`;
  // return `${salaryOut} | ${agoStr} |${counts}| «${companyR}» | *«${titleR}»* | ${tasksR} ${skillsR} | _${cityR}._ ► ${linkB}`;
  return `${salaryOut} | ${agoStr} |${counts}| «${companyR}» | *«${titleR}»* | ${tasksR} ${skillsR} | ${cityWithLinks}${scheduleR} ► ${linkB}`;
};

export const getStringifyVacancies = (vacanciesFiltered) =>
  vacanciesFiltered.map(getStringifyVacancy);

const createFilterSearch = (
  userFilter = {},
  userWords = {},
  lastRequestTime,
  isStartDay,
  addFilters = {}
) => {
  const {
    excludeWordTitle = [],
    excludeWordDesc = [],
    includeWordDesc = [],
  } = userWords;

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
    ...addFilters,
  };

  return filterVariable;
};

const formatFilterSort = (
  vacanciesRaw,
  rates,
  baseCurrency = 'RUB',
  minSalary = 0,
  maxSalary = Infinity
) => {
  const vacancies = vacanciesRaw
    .map((vacancy) => {
      let salary = {
        isSalaryDefine: false,
        avg: null,
        avgUSD: null,
        fork: null,
        forkUSD: null,
      };

      if (vacancy.salaryStr) {
        salary = parseSalaryFromTitleHH(vacancy.salaryStr, rates, baseCurrency);
      }

      return { ...vacancy, salary };
    })
    .filter(
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
  redisCache,
  addFilters
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

  const filter = createFilterSearch(
    userFilter,
    userWords,
    lastRequestTime,
    isStartDay,
    addFilters
  );
  const urlRaw = new URL(
    `${requestConfig.BASE_URL}?${qs.stringify(filter, { arrayFormat: 'repeat' })}`
  );
  const urlRawJSON = new URL(
    `${requestConfig.BASE_URL_JSON}?${qs.stringify(filter, { arrayFormat: 'repeat' })}`
  );
  const keyCache = `HH_REQUEST:${getHashByStr(urlRaw.toString())}`;

  if (await redisCache.exists(keyCache)) {
    const cachedVacanciesData = JSON.parse(await redisCache.get(keyCache)).map(
      (vacancy) => ({
        ...vacancy,
        ago: dayjs.unix(vacancy.createdAt).fromNow(),
      })
    );
    return {
      vacanciesData: cachedVacanciesData,
    };
  }
  console.log('request vacancies HeadHunter', urlRaw.toString());
  console.log('request vacancies HeadHunter JSON', urlRawJSON.toString());

  let page = 0;
  let pageMax = Infinity;
  const vacancies = [];
  let isUseCache = false;

  while (page < pageMax) {
    urlRaw.searchParams.set('page', page);
    const url = urlRaw.toString();
    urlRawJSON.searchParams.set('page', page);
    const urlJSON = urlRawJSON.toString();

    const keyCacheByPage = `HH_PAGE:${getHashByStr(url.toString())}`;
    const keyJSONCacheByPage = `HH_PAGE_JSON:${getHashByStr(urlJSON.toString())}`;

    let vacanciesData = null;
    console.log('--- --- ---> page', page + 1);

    try {
      let pageData = null;

      if (await redisCache.exists(keyCacheByPage)) {
        isUseCache = true;
        pageData = JSON.parse(await redisCache.get(keyCacheByPage));
      } else {
        isUseCache = false;
        const res = await axios.get(url, { headers: requestConfig.headers });
        pageData = await parseVacanciesFromDom(res.data, redisCache);

        await redisCache.set(
          keyCacheByPage,
          JSON.stringify(pageData),
          'EX',
          60 * 60
        );
      }
      const { vacanciesDataRaw, vacanciesCount } = pageData;

      // JSON
      let pageJSON = null;

      if (await redisCache.exists(keyJSONCacheByPage)) {
        pageJSON = JSON.parse(await redisCache.get(keyJSONCacheByPage));
      } else {
        const resJSON = await axios.get(urlJSON, {
          headers: requestConfig.headersJson,
        });
        pageJSON = resJSON.data.vacancySearchResult.vacancies.map(
          (rawJson) => ({
            vacancyId: rawJson?.vacancyId,
            responsesCount: rawJson?.responsesCount || 0, // todo: понять чем различается с totalResponsesCount
            online_users_count: rawJson?.online_users_count || 0,
            creationTime: rawJson?.creationTime,
            publicationTime: rawJson?.publicationTime?.$,
            publicationTimeUnix: rawJson?.publicationTime?.['@timestamp'],
            lastChangeTime: rawJson?.lastChangeTime?.$,
            lastChangeTimeUnix: rawJson?.lastChangeTime?.['@timestamp'],
          })
        );

        await redisCache.set(
          keyJSONCacheByPage,
          JSON.stringify(pageJSON),
          'EX',
          60 * 60
        );
      }

      const mapJsonDataByVacancyId = _.groupBy(pageJSON, 'vacancyId');

      const vacanciesDataRawWithJSON = vacanciesDataRaw.map((v) => {
        if (!mapJsonDataByVacancyId[v.id]?.[0]) {
          console.log('not vacancy in JSON', v);
          console.log('not vacancy in JSON', mapJsonDataByVacancyId);
          return v;
        }
        const json = mapJsonDataByVacancyId[v.id][0];

        return Object.assign(v, json);
      });
      // console.log('vacanciesDataRaw2 :>> ', vacanciesDataRawWithJSON);

      pageMax = Math.ceil(vacanciesCount / 20);

      vacanciesData = formatFilterSort(
        vacanciesDataRawWithJSON,
        rates,
        'RUB',
        minSalary,
        maxSalary
      );
      vacancies.push(...vacanciesData);

      if (vacanciesData.length === 0) {
        pageMax = 0;
      }
      console.log({ page, pageMax, vacanciesCount });
    } catch (error) {
      console.log('error requestVacanciesHeadHunter', error);
      throw error;
    }

    page += 1;

    // eslint-disable-next-line no-unused-expressions
    !isUseCache &&
      (await delayMs(process.env.DELAY_INTERVAL_HH_REQUEST || 20_000));
  }

  await redisCache.set(
    keyCache,
    JSON.stringify(vacancies),
    'EX',
    isStartDay ? 60 * 60 * 2 : 60 * 30
  ); // 2 hour // 5 min

  return { vacanciesData: vacancies };
};
export default requestVacanciesHeadHunter;
