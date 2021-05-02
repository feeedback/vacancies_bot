import dayjs from 'dayjs';
import {
  excludeWordTitle,
  excludeWordDesc,
  includeWordDesc,
} from '../../data/settings/hh/hh_words.js';
import myFilter from '../../data/settings/hh/my_filter.js';
import getVacancies from './api_hh.js';

const main = async () => {
  const myFiltersWords = {
    excludeWordTitle,
    excludeWordDesc,
    includeWordDesc,
  };
  const lastRequestTime = dayjs().startOf('day').unix();
  const { vacanciesData, getStringifyVacancy } = await getVacancies(
    myFilter,
    myFiltersWords,
    lastRequestTime,
    250000
  );
  console.log(vacanciesData.map((v) => getStringifyVacancy(v)));
};
main();
