const filterVacanciesSearch = {
  currency: 'RUR',
  divisions: ['apps', 'software', 'backend', 'frontend'],
  salary: '40000',
  skills: ['264'], // javascript
  sort: 'date', // 'salary_asc',
  type: 'all',
  with_salary: 'true',
};
const URL_RSS =
  'https://career.habr.com/vacancies/rss?currency=RUR&divisions[]=apps&divisions[]=software&divisions[]=backend&divisions[]=frontend&salary=40000&skills[]=264&sort=date&type=all&with_salary=1';

export default { rss: URL_RSS, filter: filterVacanciesSearch };
