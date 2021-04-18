import vacancyExcludeTagsMy from '../../data/settings/exclude_tags.js';
import vacancyExcludeWordsInDescMy from '../../data/settings/exclude_words_desc.js';
import {
  getVacancyByFilterFromRssHabrCareer,
  parseFilterFormatVacancies,
  getTopTagsByCount,
  getStringifyVacancies,
} from './api_habr_career.js';
import { getCurrencyRates } from '../utils/api_currency.js';

const getRss = async (
  url,
  day = 2,
  vacancyExcludeTags = vacancyExcludeTagsMy,
  vacancyExcludeWordsInDesc = vacancyExcludeWordsInDescMy
) => {
  const vacanciesRaw = await getVacancyByFilterFromRssHabrCareer(url, day);
  const { rates } = await getCurrencyRates(); // TODO если timestamp не сегодня, запрашивать, если сегодня- брать из кэша
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

  return { stringVacancies, topTagsByCount, topTagsByCountByFiltered };
};

export default getRss;
