import vacancyExcludeTagsMy from '../../data/settings/exclude_tags.js';
import vacancyExcludeWordsInDescMy from '../../data/settings/exclude_words_desc.js';
import {
  getVacancyByFilterFromRssHabrCareer,
  parseFilterFormatVacancies,
  getTopTagsByCount,
  getTopWordByCount,
  getStringifyVacancies,
} from './api_habr_career.js';
import { getCurrencyRates } from '../utils/api_currency.js';

const getRss = async (
  url,
  day = 2,
  vacancyExcludeTags = vacancyExcludeTagsMy,
  vacancyExcludeWordsInDesc = vacancyExcludeWordsInDescMy
) => {
  const logT = Date.now();
  const vacanciesRaw = await getVacancyByFilterFromRssHabrCareer(url, day);
  const rates = await getCurrencyRates();
  const { vacanciesFiltered, vacancies } = await parseFilterFormatVacancies(
    vacanciesRaw,
    'RUB',
    rates,
    vacancyExcludeTags,
    vacancyExcludeWordsInDesc,
    0,
    0,
    250000
  );
  const stringVacancies = getStringifyVacancies(vacanciesFiltered);

  const topTagsByCount = getTopTagsByCount(vacancies);
  const topTagsByCountByFiltered = getTopTagsByCount(vacanciesFiltered);

  const topWordsByCount = getTopWordByCount(vacancies);
  const topWordsByCountByFiltered = getTopWordByCount(vacanciesFiltered);

  const hashes = vacanciesFiltered.map(({ hashContent }) => hashContent);
  console.log('getRss', Date.now() - logT, 'ms');
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

export default getRss;
