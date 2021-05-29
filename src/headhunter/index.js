import dayjs from 'dayjs';
import _ from 'lodash';
import * as myFiltersWords from '../../data/settings/headhunter/hh_words.js';
import myFilter from '../../data/settings/headhunter/filter.js';
import requestVacancies from './api_hh.js';

const getVacanciesHeadHunter = async (
  lastRequestTime = dayjs().startOf('day').unix(),
  filter = myFilter,
  filtersWords = myFiltersWords,
  cache
) => {
  const logT = Date.now();
  const { vacanciesData: vacanciesFilteredRaw, getStringifyVacancies } = await requestVacancies(
    filter,
    filtersWords,
    lastRequestTime,
    30000,
    250000,
    cache
  );

  // const vacanciesFiltered = _.uniqBy(vacanciesFilteredRaw, 'hashContent');
  const vacanciesFiltered = Object.values(_.groupBy(vacanciesFilteredRaw, 'hashContent'))
    .map((vacancyArr) => {
      const baseVacancy = vacancyArr[0];
      // объединяем одинаковые вакансии в разных городах, выводим как одну вакансию со списком городов через ;
      if (vacancyArr.length > 1) {
        return { ...baseVacancy, city: `${vacancyArr.map(({ city }) => city).join('; ')}` };
      }

      return baseVacancy;
    })
    .sort(({ salary: { avgUSD: A } }, { salary: { avgUSD: B } }) => B - A);

  const hashes = vacanciesFiltered.map(({ hashContent }) => hashContent);

  const stringVacancies = getStringifyVacancies(vacanciesFiltered);

  console.log('getVacanciesHabrCareer', Date.now() - logT, 'ms');

  return {
    stringVacancies,
    hashes,
    vacanciesFiltered,
    getStringifyVacancies,
  };
};

export default getVacanciesHeadHunter;
