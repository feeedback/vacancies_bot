import dayjs from 'dayjs';
import axios from 'axios';
import qs from 'qs';
import LRU from 'lru-cache';
import domVacanciesParser from './dom-parser.js';
import { requestConfig, syntaxSearch as syntax, filterVacanciesSearchBase } from './config.js';
import { getHashByStr } from '../utils/utils.js';
import { getCurrencyRates } from '../utils/api_currency.js';

export const cache = new LRU({
  max: 2000,
  maxAge: 1000 * 60 * 60 * 1, // 1 hour
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
  edit = '',
  created = '',
  // ago = '',
}) => {
  const agoStr = edit !== created ? `${edit} (${created})}` : created;

  return `${salary.fork} (~${salary.avgUSD} $) | ${agoStr} | «${company}» | *«${title}»* | _${tasks} ${skills}_ | _${city}. ${schedule}_\n${link}`;
};

const createFilterSearch = (userFilter, userWords, lastRequestTime) => {
  const { excludeWordTitle, excludeWordDesc, includeWordDesc } = userWords;
  const exTitle = syntax.BY_TITLE(syntax.EXCLUDE(syntax.OR(...excludeWordTitle)));
  const exDesc = syntax.BY_DESC(syntax.EXCLUDE(syntax.OR(...excludeWordDesc)));
  const inc = syntax.BY_ALL(syntax.INCLUDE(syntax.OR(...includeWordDesc)));
  const searchText = syntax.ALL(inc, exTitle, exDesc);

  const filterVariable = {
    ...userFilter,
    ...filterVacanciesSearchBase,
    date_from: dayjs.unix(lastRequestTime).format('DD.MM.YYYY HH:mm:ss'),
    text: searchText,
  };

  return filterVariable;
};

const getVacancies = async (
  userFilter,
  userWords,
  requestPeriodSec = 5 * 60,
  lastRequestTimeRaw = null
) => {
  const rates = await getCurrencyRates();
  const lastRequestTime =
    lastRequestTimeRaw ??
    dayjs()
      .subtract(requestPeriodSec - 1, 'second')
      .unix();
  const filter = createFilterSearch(userFilter, userWords, lastRequestTime);
  const url = new URL(
    `${requestConfig.BASE_URL}?${qs.stringify(filter, { arrayFormat: 'repeat' })}`
  );
  const keyCache = getHashByStr(url);
  console.log(keyCache, { userFilter, text: filter.text });

  let vacanciesData = null;
  if (cache.has(keyCache)) {
    vacanciesData = cache.get(keyCache);
    return { vacanciesData, getStringifyVacancy };
  }

  try {
    const res = await axios.get(url.toString(), { headers: requestConfig.headers });
    vacanciesData = domVacanciesParser(res.data, 'RUB', rates);
    cache.set(keyCache, vacanciesData); // 1 hour

    return { vacanciesData, getStringifyVacancy };
  } catch (error) {
    console.log('error getVacancies', error);
    throw error;
  }
};
export default getVacancies;
