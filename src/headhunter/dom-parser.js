import jsdom from 'jsdom';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js';
import dayjsRelativeTime from 'dayjs/plugin/relativeTime.js';
import dayjsUtc from 'dayjs/plugin/utc.js';
import { URL } from 'url';
// import LRU from 'lru-cache';
import { getHashByStr } from '../utils/utils.js';
import { parseSalaryFromTitleRaw } from '../utils/api_currency.js';

// export const cacheHashVacancyCreatedAt = new LRU({
//   max: 10000,
//   maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
// });

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsRelativeTime);
dayjs.extend(dayjsUtc);
const getDOMDocument = (data) => new jsdom.JSDOM(data).window.document;

const BASE_VACANCY_LINK = 'https://hh.ru/vacancy';

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

  const rawCount = document.querySelector(`h1[data-qa^=bloko-header]`);
  if (!rawCount || !rawCount.childNodes) {
    console.log(rawCount, document);
  }
  let vacanciesCount = Number(rawCount.childNodes[0].textContent.replaceAll(/\s/g, ''));
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(vacanciesCount)) {
    vacanciesCount = 0;
  }
  const vacanciesEl = [...document.querySelectorAll('.serp-item')];

  console.log('Получено:', vacanciesEl.length, 'Вакансий — HeadHunter');

  const getChildTextByDataAttr = (el, str, addStr = '', isText = true) => {
    const child = el.querySelector(`[data-qa="${str}"]${addStr ? `${` ${addStr}`}` : ''}`);
    return isText ? child?.textContent?.trim() || '' : child;
  };

  const vacanciesDataRaw = [];
  for (const vacancy of vacanciesEl) {
    // console.log('vacancy', JSON.stringify(vacancy));
    const getElTextByAttr = (attr, ...restArgs) =>
      getChildTextByDataAttr(vacancy, attr, ...restArgs);

    const tasks = getElTextByAttr('vacancy-serp__vacancy_snippet_responsibility').replace(
      /<\/?highlighttext>/gi,
      ''
    );
    const skills = getElTextByAttr('vacancy-serp__vacancy_snippet_requirement').replace(
      /<\/?highlighttext>/gi,
      ''
    );
    const title = getElTextByAttr('serp-item__title');

    const idFromLink = getElTextByAttr('serp-item__title', '', false).parentElement
      .href.split('?')?.[0]
      ?.split('vacancy/')?.[1];
    const idFromButton = new URL(
      `https://hh.ru${getElTextByAttr('vacancy-serp__vacancy_response', '', false)?.href}`
    )?.searchParams?.get('vacancyId');

    const id = idFromLink || idFromButton;
    const link = `${BASE_VACANCY_LINK}/${id}`;

    const salaryStr = getElTextByAttr('vacancy-serp__vacancy-compensation');

    const scheduleRaw =
      getElTextByAttr('vacancy-serp__vacancy-work-schedule') ||
      getElTextByAttr('vacancy-label-remote-work-schedule') ||
      '';

    // eslint-disable-next-line no-irregular-whitespace
    // const schedule = ['Можно работать из дома', 'Можно из дома', 'Можно из дома'].includes(scheduleRaw);
    const schedule = scheduleRaw.includes('дома');

    const company = getElTextByAttr('vacancy-serp__vacancy-employer');
    const address = getElTextByAttr('vacancy-serp__vacancy-address');
    const city = address.split(',')[0];

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
