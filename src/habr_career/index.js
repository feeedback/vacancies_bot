import _ from 'lodash';
import vacancyExcludeTagsMy from '../../data/settings/habr_career/exclude_tags.js';
import vacancyExcludeWordsInDescMy from '../../data/settings/habr_career/exclude_words_title.js';
import {
  getVacancyByFilterFromRssHabrCareer,
  parseFilterFormatVacancies,
  getTopTagsByCount,
} from './api_habr_career.js';
import { getCurrencyRates } from '../utils/api_currency.js';
import { getTopWordsByCountFromVacanciesDataByField } from '../utils/utils.js';
import { MIN_SALARY_DEFAULT } from '../utils/constant.js';

const getVacanciesHabrCareer = async (
  url,
  day = 2,
  vacancyExcludeTags = vacancyExcludeTagsMy || [],
  vacancyExcludeWordsInDesc = vacancyExcludeWordsInDescMy || [],
  cache,
  minSalary = MIN_SALARY_DEFAULT,
  maxSalary = 1_000_000
) => {
  const logT = Date.now();
  let vacanciesRaw = [];

  if (Array.isArray(url)) {
    const rawHabr = [];
    for (const urlOne of url) {
      rawHabr.push(...(await getVacancyByFilterFromRssHabrCareer(urlOne, cache, day)));
    }
    vacanciesRaw = _.uniqBy(rawHabr, 'guid');
  } else {
    vacanciesRaw = await getVacancyByFilterFromRssHabrCareer(url, cache, day);
  }

  const rates = await getCurrencyRates();

  const { vacanciesFiltered: vacanciesFilteredRaw, vacancies } = await parseFilterFormatVacancies(
    vacanciesRaw,
    rates,
    'RUB',
    vacancyExcludeTags,
    vacancyExcludeWordsInDesc,
    0,
    0,
    minSalary,
    maxSalary
  );
  const vacanciesFiltered = vacanciesFilteredRaw;

  const topTagsByCount = getTopTagsByCount(vacancies);
  const topTagsByCountByFiltered = getTopTagsByCount(vacanciesFiltered);

  const topWordsByCount = getTopWordsByCountFromVacanciesDataByField(vacancies, 'titleShort');
  const topWordsByCountByFiltered = getTopWordsByCountFromVacanciesDataByField(
    vacanciesFiltered,
    'titleShort'
  );

  const hashes = vacanciesFiltered.map(({ hashContent }) => hashContent);
  console.log('getVacanciesHabrCareer', Date.now() - logT, 'ms');

  return {
    hashes,
    vacanciesFiltered,
    topTagsByCount,
    topTagsByCountByFiltered,
    topWordsByCount,
    topWordsByCountByFiltered,
  };
};

export default getVacanciesHabrCareer;
