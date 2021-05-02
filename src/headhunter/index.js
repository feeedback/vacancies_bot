import dayjs from 'dayjs';
import * as myFiltersWords from '../../data/settings/hh/hh_words.js';
import myFilter from '../../data/settings/hh/my_filter.js';
import requestVacancies from './api_hh.js';

const getVacancies = async (
  lastRequestTime = dayjs().startOf('day').unix(),
  filter = myFilter,
  filtersWords = myFiltersWords
) => {
  const { vacanciesData: vacanciesFiltered, getStringifyVacancies } = await requestVacancies(
    filter,
    filtersWords,
    lastRequestTime,
    250000
  );
  const hashes = vacanciesFiltered.map(({ hashContent }) => hashContent);
  const stringVacancies = getStringifyVacancies(vacanciesFiltered);
  console.log('stringVacancies HHHHHH:>> ', stringVacancies);
  return {
    stringVacancies,
    hashes,
    vacanciesFiltered,
    getStringifyVacancies,
  };
};
// getVacancies();
export default getVacancies;
