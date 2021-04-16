import vacancyExcludeTags from '../data/exclude_tags.js';
import vacancyExcludeWordsInDesc from '../data/exclude_words_desc.js';
import {
  getVacancyByFilterFromRssHabrCareer,
  parseFilterFormatVacancies,
} from './api_habr_career.js';

// const filterVacanciesSearch = {
//   currency: 'RUR',
//   divisions: ['apps', 'software', 'backend', 'frontend'],
//   salary: '40000',
//   skills: ['264'], // javascript
//   sort: 'date', // 'salary_asc',
//   type: 'all',
//   with_salary: 'true',
// };

// const URL_RSS =
//   'https://career.habr.com/vacancies/rss?currency=RUR&divisions[]=apps&divisions[]=software&divisions[]=backend&divisions[]=frontend&salary=40000&skills[]=264&sort=date&type=all&with_salary=1';

const getRss = async (url, day = 2) => {
  const vacanciesRaw = await getVacancyByFilterFromRssHabrCareer(url, day);
  const { stringVacancies } = await parseFilterFormatVacancies(
    vacanciesRaw,
    'RUB',
    vacancyExcludeTags,
    vacancyExcludeWordsInDesc,
    0,
    0,
    250000
  );
  return stringVacancies;
};
// main(URL_RSS);

export default getRss;
