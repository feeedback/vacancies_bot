export const BASE_LINK = 'https://hh.ru';
export const BASE_VACANCY_LINK = `${BASE_LINK}/vacancy`;

export const SELECTORS_FOR_ELEMENTS = {
  titleHeader: 'h1[data-qa=title]',
  vacanciesCountOnThisPage: '[data-qa~="vacancy-serp__vacancy"]',
  vacancyBlock: '[data-qa~="vacancy-serp__vacancy"]',

  vacancySalary: '[class*="compensation-"]',
  ATTRIBUTES: {
    vacancyTasks: 'vacancy-serp__vacancy_snippet_responsibility',
    vacancySkills: 'vacancy-serp__vacancy_snippet_requirement',
    vacancyTitle: 'serp-item__title',
    vacancyButtonApply: 'vacancy-serp__vacancy_response',
    // vacancyScheduleRemote: '[class*="compensation-"]',
    vacancyCompany: 'vacancy-serp__vacancy-employer',
    vacancyAddress: 'vacancy-serp__vacancy-address',
  },
};
