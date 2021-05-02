import dayjs from 'dayjs';
import axios from 'axios';
import qs from 'qs';
import domVacanciesParser from './dom-parser.js';
import { requestConfig, syntaxSearch as syntax, filterVacanciesSearchBase } from './config.js';

import { getCurrencyRates } from '../utils/api_currency.js';

const createFilterSearch = (userFilter, userWords) => {
  const { excludeWordTitle, excludeWordDesc, includeWordDesc } = userWords;
  const exTitle = syntax.BY_TITLE(syntax.EXCLUDE(syntax.OR(...excludeWordTitle)));
  const exDesc = syntax.BY_DESC(syntax.EXCLUDE(syntax.OR(...excludeWordDesc)));
  const inc = syntax.BY_ALL(syntax.INCLUDE(syntax.OR(...includeWordDesc)));
  const searchText = syntax.ALL(inc, exTitle, exDesc);

  const filterVariable = {
    ...userFilter,
    ...filterVacanciesSearchBase,
    date_from: dayjs().subtract('300', 'minute').format('DD.MM.YYYY HH:mm:ss'), // last request time
    text: searchText,
  };

  return filterVariable;
};

const getVacancies = async (userFilter, userWords) => {
  const rates = await getCurrencyRates();

  const filter = createFilterSearch(userFilter, userWords);
  const url = new URL(
    `${requestConfig.BASE_URL}?${qs.stringify(filter, { arrayFormat: 'repeat' })}`
  );
  console.log({ userFilter, text: filter.text });

  try {
    const res = await axios.get(url.toString(), { headers: requestConfig.headers });
    const { vacanciesData, getStringifyVacancy } = domVacanciesParser(res.data, 'RUB', rates);

    return { vacanciesData, getStringifyVacancy };
  } catch (error) {
    console.log('error getVacancies', error);
    throw error;
  }
};
export default getVacancies;
