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

console.log(syntax.ALL(inc, exTitle, exDesc));
// const BASE_URL = 'https://hh.ru/search/vacancy?';
// // qs.stringify({ a: ['b', 'c'] }, { arrayFormat: 'repeat' })
// const filterVacanciesSearch = {
//   L_is_autosearch: true,
//   date_from: '30.04.2021 10:51:11',

//   salary: 50000,
//   schedule: ['remote'],
//   employment: ['full', 'part', 'probation'],
//   experience: ['between1And3'],
//   order_by: 'publication_time',
//   no_magic: true, // ???
//   items_on_page: 100,
//   only_with_salary: true,
//   text: searchText,
// };
