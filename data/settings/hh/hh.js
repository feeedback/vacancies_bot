import dayjs from 'dayjs';
import axios from 'axios';
import qs from 'qs';
import domVacanciesParser from './dom-parser.js';
import hh from './config.js';
import { excludeWordTitle, excludeWordDesc, includeWordDesc } from './hh_words.js';

const syntax = {
  AND: (...wordsArr) => wordsArr.join(' AND '),
  OR: (...wordsArr) => wordsArr.join(' OR '),
  EXCLUDE: (wordsStr) => `NOT (${wordsStr})`,
  INCLUDE: (wordsStr) => `(${wordsStr})`,
  BY_TITLE: (wordsStr) => `NAME:(${wordsStr})`,
  BY_DESC: (wordsStr) => `DESCRIPTION:(${wordsStr})`,
  BY_ALL: (wordsStr) => `(${wordsStr})`,
  ALL: (...str) => str.join(' '),
};

const exTitle = syntax.BY_TITLE(syntax.EXCLUDE(syntax.OR(...excludeWordTitle)));
const exDesc = syntax.BY_DESC(syntax.EXCLUDE(syntax.OR(...excludeWordDesc)));
const inc = syntax.BY_ALL(syntax.INCLUDE(syntax.OR(...includeWordDesc)));
const searchText = syntax.ALL(inc, exTitle, exDesc);

console.log(searchText);

const filterVacanciesSearch = {
  L_is_autosearch: true,
  // date_from: '30.04.2021 10:51:11',
  // date_from: dayjs().subtract('5', 'minute').format('DD.MM.YYYY HH:mm:ss'), // last request time
  date_from: dayjs().subtract('300', 'minute').format('DD.MM.YYYY HH:mm:ss'), // last request time

  salary: 40000,
  schedule: ['remote'],
  employment: ['full', 'part', 'probation'],
  experience: ['between1And3'],
  order_by: 'publication_time',
  no_magic: true, // ???
  items_on_page: 100,
  only_with_salary: true,
  text: searchText,
};

const getVacancies = async (filterParam) => {
  let filter = filterParam;
  if (typeof filter === 'string') {
    filter = qs.parse(new URL(filter).search.slice(1));
  }
  const url = new URL(`${hh.BASE_URL}?${qs.stringify(filter, { arrayFormat: 'repeat' })}`);
  // const url = new URL(`${hh.BASE_URL}`);

  console.log(decodeURI(url));

  try {
    const res = await axios.get(url.toString(), { headers: hh.headers });
    const vacancies = domVacanciesParser(res.data);
    return vacancies;
  } catch (error) {
    console.log('error getVacancies', error);
    throw error;
  }
};
getVacancies(filterVacanciesSearch);
