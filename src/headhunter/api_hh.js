import dayjs from 'dayjs';
import axios from 'axios';
import qs from 'qs';
import LRU from 'lru-cache';
import { parseVacanciesFromDom, parseSalaryFromTitleHH } from './dom-parser.js';
import { requestConfig, syntaxSearch as syntax, filterVacanciesSearchBase } from './config.js';
import { getHashByStr } from '../utils/utils.js';
import { getCurrencyRates } from '../utils/api_currency.js';

export const cache = new LRU({
  max: 1000,
  maxAge: 1000 * 60 * 60 * 24 * 10, // 10 days
});

const getStringifyVacancy = ({
  title = '',
  tasks = '',
  skills = '',
  link = '',
  salary,
  company = '',
  schedule = '',
  city = '',
  ago = '',
}) => {
  // const agoStr = edit !== created ? `${edit} (${created})}` : created;
  const salaryOut = salary.isSalaryDefine ? `${salary.fork} (~${salary.avgUSD} $)` : '_Не указана_';
  const linkB = link.split('hh').join('*hh*').split('://')[1];
  const companyR = company.replace(/[_$*]/g, '-');
  const titleR = title.replace(/[_$*]/g, '-');
  const tasksR = tasks.replace(/[_$*]/g, '-');
  const skillsR = skills.replace(/[_$*]/g, '-');
  const cityR = city.replace(/[_$*]/g, '-');
  const scheduleR = schedule.replace(/[_$*]/g, '-');

  return `${salaryOut} | ${ago} | «${companyR}» | *«${titleR}»* | ${tasksR} ${skillsR} | _${cityR}. ${scheduleR}_ ► ${linkB}`;
};

const getStringifyVacancies = (vacanciesFiltered) => vacanciesFiltered.map(getStringifyVacancy);

const createFilterSearch = (userFilter = {}, userWords = {}, lastRequestTime) => {
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
    date_from: dayjs.unix(lastRequestTime).format('DD.MM.YYYY HH:mm:ss'),
    text: searchText,
  };

  return filterVariable;
};

const formatFilterSort = (
  vacanciesRaw,
  baseCurrency = 'RUB',
  rates = { RUB: 75, USD: 1 },
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
    .filter(({ salary: { avg, isSalaryDefine } }) => !isSalaryDefine || avg < maxSalary)
    .sort(({ salary: { avgUSD: A } }, { salary: { avgUSD: B } }) => B - A);

  return vacancies;
};

const requestVacanciesHeadHunter = async (
  userFilter,
  userWords,
  lastRequestTime = dayjs().startOf('day').unix(),
  maxSalary = Infinity
) => {
  const rates = await getCurrencyRates();
  const filter = createFilterSearch(userFilter, userWords, lastRequestTime);
  const url = new URL(
    `${requestConfig.BASE_URL}?${qs.stringify(filter, { arrayFormat: 'repeat' })}`
  ).toString();
  const keyCache = getHashByStr(url);
  console.log('request vacancies HeadHunter', url);

  let vacanciesData = null;
  if (cache.has(keyCache)) {
    vacanciesData = cache.get(keyCache);
    return { vacanciesData, getStringifyVacancies };
  }

  try {
    const res = await axios.get(url, { headers: requestConfig.headers });
    const vacanciesDataRaw = parseVacanciesFromDom(res.data);

    vacanciesData = formatFilterSort(vacanciesDataRaw, 'RUB', rates, maxSalary);
    cache.set(keyCache, vacanciesData); // 1 hour

    return { vacanciesData, getStringifyVacancies };
  } catch (error) {
    console.log('error requestVacanciesHeadHunter', error);
    throw error;
  }
};
export default requestVacanciesHeadHunter;
