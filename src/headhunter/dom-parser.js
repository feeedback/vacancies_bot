import jsdom from 'jsdom';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js';
import dayjsRelativeTime from 'dayjs/plugin/relativeTime.js';
import dayjsUtc from 'dayjs/plugin/utc.js';
import { URL } from 'url';
// import LRU from 'lru-cache';
import prettier from 'prettier';
import { getHashByStr } from '../utils/utils.js';
import { parseSalaryFromTitleRaw } from '../utils/api_currency.js';
import { BASE_LINK, BASE_VACANCY_LINK, SELECTORS_FOR_ELEMENTS } from './dom-parser.constants.js';

// export const cacheHashVacancyCreatedAt = new LRU({
//   max: 10000,
//   maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
// });

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsRelativeTime);
dayjs.extend(dayjsUtc);
const getDOMDocument = (data) => new jsdom.JSDOM(data).window.document;

export const parseSalaryFromTitleHH = (stringTitleVacancy, rates, baseCurrency = 'RUB') => {
  // const regExpPatternSalary = /(?:(?:^(?:от)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:до)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:(\d[\s\d]*\d)+)\s[−‐‑-ꟷー一]\s(?:(\d[\s\d]*\d)+)))(?: (.+)$)/i;
  const regExpPatternSalary = /(?:(?:^(?:от)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:до)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:(\d[\s\d]*\d)+)\s*.?\s*(?:(\d[\s\d]*\d)+)))(?: (.+)$)/i;
  const mapCurrencyStrToSymbol = {
    'USD': '$',
    'руб.': '₽',
    '$': '$',
    '₽': '₽',
  };
  const salary = stringTitleVacancy.match(regExpPatternSalary);

  if (!salary) {
    return { isSalaryDefine: false, avg: null, avgUSD: null, fork: null, forkUSD: null };
  }

  const [, rawMin, rawMax, rawFrom, rawTo, rawCurrencyStr] = salary;
  const min = rawFrom ?? rawMin;
  const max = rawTo ?? rawMax;
  const rawCurrencySymbol = mapCurrencyStrToSymbol[rawCurrencyStr];

  return parseSalaryFromTitleRaw(baseCurrency, rates, min, max, rawCurrencySymbol);
};

// export const pageVacanciesCount = (data) => {
//   const document = getDOMDocument(data);

//   return document.querySelectorAll('.bloko-button-group > span').length;
// };

export const parseVacanciesFromDom = async (data, redisCache) => {
  const document = getDOMDocument(data);

  const rawCount = document.querySelector(SELECTORS_FOR_ELEMENTS.vacanciesCountHeader);
  if (!rawCount || !rawCount.childNodes) {
    console.log(rawCount, document);
    throw new Error('Битый ответ HTML от HH');
  }
  let vacanciesCount = Number(rawCount.childNodes[0].textContent.replaceAll(/\s/g, ''));
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(vacanciesCount)) {
    vacanciesCount = 0;
  }
  const vacanciesEl = document.querySelectorAll(SELECTORS_FOR_ELEMENTS.vacancyBlock);

  console.log('Получено:', vacanciesEl.length, 'Вакансий — HeadHunter');

  const getChildTextBySelector = (el, selector, isText = true) => {
    const child = el.querySelector(selector);
    return isText ? child?.textContent?.trim() || '' : child;
  };
  const getChildTextByDataAttr = (el, str, addStr = '', isText = true) => {
    const child = el.querySelector(`[data-qa="${str}"]${addStr ? `${` ${addStr}`}` : ''}`);
    return isText ? child?.textContent?.trim() || '' : child;
  };
  const debug = false;

  const vacanciesDataRaw = [];

  for (const vacancy of vacanciesEl) {
    const getElTextByAttr = (attr, ...restArgs) =>
      getChildTextByDataAttr(vacancy, attr, ...restArgs);

    const tasks = getElTextByAttr(SELECTORS_FOR_ELEMENTS.ATTRIBUTES.vacancyTasks).replace(
      /<\/?highlighttext>/gi,
      ''
    );
    if (debug) console.log('tasks :>> ', tasks);

    const skills = getElTextByAttr(SELECTORS_FOR_ELEMENTS.ATTRIBUTES.vacancySkills).replace(
      /<\/?highlighttext>/gi,
      ''
    );
    if (debug) console.log('skills :>> ', skills);

    const title = getElTextByAttr(SELECTORS_FOR_ELEMENTS.ATTRIBUTES.vacancyTitle);
    if (debug) console.log('title :>> ', title);
    if (debug && !title)
      console.log('vacancy', prettier.format(vacancy.innerHTML, { parser: 'html' }));

    const titleElement = getElTextByAttr(SELECTORS_FOR_ELEMENTS.ATTRIBUTES.vacancyTitle, '', false);
    if (debug) console.log('titleElement :>> ', titleElement);

    const idFromLink = titleElement.parentElement.href.split('?')?.[0]?.split('vacancy/')?.[1];
    if (debug) console.log('idFromLink :>> ', idFromLink);

    const vacancyButtonApply = getElTextByAttr(
      SELECTORS_FOR_ELEMENTS.ATTRIBUTES.vacancyButtonApply,
      '',
      false
    );
    if (debug) console.log('vacancyButtonApply :>> ', vacancyButtonApply);

    const idFromButton = new URL(`${BASE_LINK}${vacancyButtonApply?.href}`)?.searchParams?.get(
      'vacancyId'
    );
    if (debug) console.log('idFromButton :>> ', idFromButton);

    const id = idFromLink || idFromButton;
    const link = `${BASE_VACANCY_LINK}/${id}`;

    const salaryStr = getChildTextBySelector(vacancy, SELECTORS_FOR_ELEMENTS.vacancySalary);
    if (debug) console.log('salaryStr :>> ', salaryStr);

    const scheduleRaw =
      // getElTextByAttr('vacancy-serp__vacancy-work-schedule') ||
      getElTextByAttr(SELECTORS_FOR_ELEMENTS.ATTRIBUTES.vacancyScheduleRemote) || '';
    if (debug) console.log('scheduleRaw :>> ', scheduleRaw);

    const schedule = ['дома', 'удаленно', 'удалённо'].some((str) =>
      scheduleRaw.toLowerCase().includes(str)
    );
    if (debug) console.log('schedule :>> ', schedule);

    const company = getElTextByAttr(SELECTORS_FOR_ELEMENTS.ATTRIBUTES.vacancyCompany);
    if (debug) console.log('company :>> ', company);

    const address = getElTextByAttr(SELECTORS_FOR_ELEMENTS.ATTRIBUTES.vacancyAddress);
    if (debug) console.log('address :>> ', address);

    const city = address.split(',')[0];
    if (debug) console.log('city :>> ', city);

    const content = [title, company, salaryStr, tasks, skills, schedule].join('\n');
    const text = [title, company, tasks, skills].join('\n');

    const hashContent = getHashByStr(content);

    const cachedCreatedAt = await redisCache.get(`HH:vacancyCreatedAt:${hashContent}`);

    const createdAt = cachedCreatedAt ?? dayjs().unix();
    const ago = dayjs.unix(+createdAt).fromNow();

    if (!cachedCreatedAt) {
      await redisCache.set(`HH:vacancyCreatedAt:${hashContent}`, createdAt);
    }

    vacanciesDataRaw.push({
      id,
      title,
      tasks,
      skills,
      link,
      company,
      schedule,
      // address,
      salaryStr,
      city,
      // bumpedAt,
      createdAt,
      // bumpedAgo,
      // content,
      text,
      hashContent,
      ago: ago === 'a few seconds ago' ? 'a minute ago' : ago,
      source: 'HEADHUNTER',
    });
  }

  return { vacanciesDataRaw, vacanciesCount };
};
