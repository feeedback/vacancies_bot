import vacancyExcludeTagsMy from '../data/exclude_tags.js';
import vacancyExcludeWordsInDescMy from '../data/exclude_words_desc.js';
import {
  getVacancyByFilterFromRssHabrCareer,
  parseFilterFormatVacancies,
  getTopTagsByCount,
  getStringifyVacancies,
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

const getRss = async (
  url,
  day = 2,
  vacancyExcludeTags = vacancyExcludeTagsMy,
  vacancyExcludeWordsInDesc = vacancyExcludeWordsInDescMy
) => {
  const vacanciesRaw = await getVacancyByFilterFromRssHabrCareer(url, day);
  const { vacanciesFiltered, vacancies } = await parseFilterFormatVacancies(
    vacanciesRaw,
    'RUB',
    vacancyExcludeTags,
    vacancyExcludeWordsInDesc,
    0,
    0,
    250000
  );
  const stringVacancies = getStringifyVacancies(vacanciesFiltered);

  const topTagsByCount = getTopTagsByCount(vacancies);
  const topTagsByCountByFiltered = getTopTagsByCount(vacanciesFiltered);

  return { stringVacancies, topTagsByCount, topTagsByCountByFiltered };
};

export default getRss;
