import { URL } from 'url';
import qs from 'qs';

const filterVacanciesSearch = {
  currency: 'RUR',
  s: [2, 3, 82, 4, 5, 72, 6, 77, 8, 73, 86, 106], // вместо  divisions: ['apps', 'software', 'backend', 'frontend'],
  // salary: '40000',
  sort: 'date', // 'salary_asc',
  type: 'all',
  // with_salary: 'true',
  skills: ['264'], // javascript
};

const filterVacanciesSearch2 = {
  ...filterVacanciesSearch,
  skills: ['12'], // node.js
};
const filterVacanciesSearch3 = {
  ...filterVacanciesSearch,
  skills: ['245'], // TypeScript
};

// const URL_RSS =
//   'https://career.habr.com/vacancies/rss?currency=RUR&divisions[]=apps&divisions[]=software&divisions[]=backend&divisions[]=frontend&salary=40000&skills[]=264&sort=date&type=all&with_salary=1';

const createRssLinkFromFilter = (filter) => {
  const HABR_CAREER_URL_RSS = 'https://career.habr.com/vacancies/rss';

  return new URL(`${HABR_CAREER_URL_RSS}?${qs.stringify(filter, { arrayFormat: 'brackets' })}`);
};
// console.log(createRssLinkFromFilter(filterVacanciesSearch).toString());

export default {
  filter: filterVacanciesSearch,
  rss: createRssLinkFromFilter(filterVacanciesSearch).toString(),
  rss2: createRssLinkFromFilter(filterVacanciesSearch2).toString(),
  rss3: createRssLinkFromFilter(filterVacanciesSearch3).toString(),
};
