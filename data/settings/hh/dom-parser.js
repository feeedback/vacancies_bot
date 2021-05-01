const BASE_VACANCY_LINK = 'https://hh.ru/vacancy';
const REGEX_SALARY = /(?:(?:^(?:от)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:до)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:(\d[\s\d]*\d)+)-(?:(\d[\s\d]*\d)+)))(?: (.+)$)/gi;
const mapCurrencyStrToCode = {
  'USD': 'USD',
  'руб.': 'RUB',
};

const vacanciesEl = [...document.querySelectorAll('.vacancy-serp-item')];
const getChildTextByDataAttr = (el, str, addStr = '', isText = true) => {
  const child = el.querySelector(`[data-qa="${str}"] ${addStr}`);
  return isText ? child.textContent : child;
};

const vacanciesData = vacanciesEl.map((vacancy) => {
  const getElByAttr = (attr, selector) => getChildTextByDataAttr(vacancy, attr, selector);

  const tasks = getElByAttr('vacancy-serp__vacancy_snippet_responsibility');
  const skills = getElByAttr('vacancy-serp__vacancy_snippet_requirement');
  const title = getElByAttr('vacancy-serp__vacancy-title');

  const id = getElByAttr('vacancy-serp__vacancy-title', '', false)
    .href.split('?')[0]
    .split('vacancy/')[1];
  const link = `${BASE_VACANCY_LINK}/${id}`;

  const salaryStr = getElByAttr('vacancy-serp__vacancy-compensation').trim();
  const [, rawMin, rawMax, rawFrom, rawTo, rawCurrencySymbol] = salaryStr.match(REGEX_SALARY);

  const salary = {
    rawMin,
    rawMax,
    rawFrom,
    rawTo,
    rawCurrencySymbol: mapCurrencyStrToCode[rawCurrencySymbol],
  };
  const company = getElByAttr('vacancy-serp__vacancy-employer');
  const address = getElByAttr('vacancy-serp__vacancy-address');

  const dateMonthDay = getElByAttr(
    'vacancy-serp__vacancy-date',
    '.vacancy-serp-item__publication-date_short'
  );
  return {
    tasks,
    skills,
    title,
    id,
    link,
    salary,
    company,
    address,
    dateMonthDay,
  };
});

console.log(vacanciesData);
