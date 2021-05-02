import {
  excludeWordTitle,
  excludeWordDesc,
  includeWordDesc,
} from '../../data/settings/hh/hh_words.js';
import userFilter from '../../data/settings/hh/my_filter.js';
import getVacancies from './hh.js';

const main = async () => {
  const { vacanciesData, getStringifyVacancy } = await getVacancies(userFilter, {
    excludeWordTitle,
    excludeWordDesc,
    includeWordDesc,
  });
  console.log(vacanciesData.map((v) => getStringifyVacancy(v)));
};
main();
