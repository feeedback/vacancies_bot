import vacancyExcludeTagsMy from '../../data/settings/habr_career/exclude_tags.js';
import vacancyExcludeWordsInDescMy from '../../data/settings/habr_career/exclude_words_title.js';
import {
  getVacancyByFilterFromRssHabrCareer,
  parseFilterFormatVacancies,
  getTopTagsByCount,
  getTopWordByCount,
  getStringifyVacancies,
} from './api_habr_career.js';
import { getCurrencyRates } from '../utils/api_currency.js';

const getVacanciesHabrCareer = async (
  url,
  day = 2,
  vacancyExcludeTags = vacancyExcludeTagsMy,
  vacancyExcludeWordsInDesc = vacancyExcludeWordsInDescMy,
  cache
) => {
  const logT = Date.now();
  const vacanciesRaw = await getVacancyByFilterFromRssHabrCareer(url, day, cache);
  const rates = await getCurrencyRates();
  const { vacanciesFiltered, vacancies } = await parseFilterFormatVacancies(
    vacanciesRaw,
    'RUB',
    rates,
    vacancyExcludeTags,
    vacancyExcludeWordsInDesc,
    0,
    0,
    30000,
    250000
  );
  const stringVacancies = getStringifyVacancies(vacanciesFiltered);

  const topTagsByCount = getTopTagsByCount(vacancies);
  const topTagsByCountByFiltered = getTopTagsByCount(vacanciesFiltered);

  const topWordsByCount = getTopWordByCount(vacancies);
  const topWordsByCountByFiltered = getTopWordByCount(vacanciesFiltered);

  const hashes = vacanciesFiltered.map(({ hashContent }) => hashContent);
  console.log('getVacanciesHabrCareer', Date.now() - logT, 'ms');

  return {
    stringVacancies,
    hashes,
    vacanciesFiltered,
    getStringifyVacancies,
    topTagsByCount,
    topTagsByCountByFiltered,
    topWordsByCount,
    topWordsByCountByFiltered,
  };
};

export default getVacanciesHabrCareer;
