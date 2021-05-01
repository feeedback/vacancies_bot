const BASE_VACANCY_LINK = 'https://hh.ru/vacancy';

const vacanciesEl = [...document.querySelectorAll('.vacancy-serp-item')];

const tasks = vacancy.querySelector('[data-qa="vacancy-serp__vacancy_snippet_responsibility"]')
  .textContent;
const skills = vacancy.querySelector('[data-qa="vacancy-serp__vacancy_snippet_requirement"]')
  .textContent;
const title = vacancy.querySelector('[data-qa="vacancy-serp__vacancy-title"]').textContent;
const id = vacancy
  .querySelector('[data-qa="vacancy-serp__vacancy-title"]')
  .split('?')[0]
  .split('vacancy/')[1];
const link = `${BASE_VACANCY_LINK}/${id}`;

const salaryStr = vacancy.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]')
  .textContent;
const company = vacancy.querySelector('[data-qa="vacancy-serp__vacancy-employer"]').textContent;
const address = vacancy.querySelector('[data-qa="vacancy-serp__vacancy-address"]').textContent;
const dateMonthDay = vacancy.querySelector(
  '[data-qa="vacancy-serp__vacancy-date"] .vacancy-serp-item__publication-date_short'
).textContent;
const mapCurrencyStrToCode = {
  'USD': 'USD',
  'руб.': 'RUB',
};
const REGEX_SALARY = /(?:(?:^(?:от)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:до)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:(\d[\s\d]*\d)+)-(?:(\d[\s\d]*\d)+)))(?: (.+)$)/gi;
