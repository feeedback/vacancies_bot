export const BASE_LINK = 'https://hh.ru';
export const BASE_VACANCY_LINK = `${BASE_LINK}/vacancy`;

export const SELECTORS_FOR_ELEMENTS = {
  vacanciesCountHeader: 'h1[data-qa^=bloko-header]',
  vacancyBlock: '[data-qa~="vacancy-serp__vacancy"]',

  vacancySalary: '[class*="compensation-text"]',
  ATTRIBUTES: {
    vacancyTasks: 'vacancy-serp__vacancy_snippet_responsibility',
    vacancySkills: 'vacancy-serp__vacancy_snippet_requirement',
    vacancyTitle: 'serp-item__title',
    vacancyButtonApply: 'vacancy-serp__vacancy_response',
    vacancyScheduleRemote: 'vacancy-label-remote-work-schedule',
    vacancyCompany: 'vacancy-serp__vacancy-employer',
    vacancyAddress: 'vacancy-serp__vacancy-address',
  },
};
