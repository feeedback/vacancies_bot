import jsdom from 'jsdom';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js';
import dayjsRelativeTime from 'dayjs/plugin/relativeTime.js';
import dayjsUtc from 'dayjs/plugin/utc.js';

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

export const parseSalaryFromTitleHH = (
  stringTitleVacancy,
  baseCurrency = 'RUB',
  rates = { RUB: 75, USD: 1 }
) => {
  // const regExpPatternSalary = /(?:(?:^(?:от)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:до)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:(\d[\s\d]*\d)+)\s[−‐‑-ꟷー一]\s(?:(\d[\s\d]*\d)+)))(?: (.+)$)/i;
  const regExpPatternSalary = /(?:(?:^(?:от)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:до)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:(\d[\s\d]*\d)+)\s*.?\s*(?:(\d[\s\d]*\d)+)))(?: (.+)$)/i;
  const mapCurrencyStrToSymbol = {
    'USD': '$',
    'руб.': '₽',
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
  // console.log(document.documentElement.outerHTML);
  const vacanciesCount = Number(
    document.querySelector(`h1.bloko-header-1`).childNodes[0].textContent
  );
  const vacanciesEl = [...document.querySelectorAll('.vacancy-serp-item')];

  console.log('Получено:', vacanciesEl.length, 'Вакансий — HeadHunter');
  const getChildTextByDataAttr = (el, str, addStr = '', isText = true) => {
    const child = el.querySelector(`[data-qa="${str}"]${addStr ? `${` ${addStr}`}` : ''}`);
    return isText ? child?.textContent?.trim() || '' : child;
  };

  const vacanciesDataRaw = [];
  for (const vacancy of vacanciesEl) {
    // console.log('vacancy', '№:', i);
    const getElByAttr = (attr, ...restArgs) => getChildTextByDataAttr(vacancy, attr, ...restArgs);

    const tasks = getElByAttr('vacancy-serp__vacancy_snippet_responsibility').replace(
      /<\/?highlighttext>/gi,
      ''
    );
    const skills = getElByAttr('vacancy-serp__vacancy_snippet_requirement').replace(
      /<\/?highlighttext>/gi,
      ''
    );
    const title = getElByAttr('vacancy-serp__vacancy-title');

    const id = getElByAttr('vacancy-serp__vacancy-title', '', false)
      .href.split('?')[0]
      .split('vacancy/')[1];
    const link = `${BASE_VACANCY_LINK}/${id}`;

    const salaryStr = getElByAttr('vacancy-serp__vacancy-compensation');

    const scheduleRaw = getElByAttr('vacancy-serp__vacancy-work-schedule');
    const schedule = scheduleRaw === 'Можно работать из дома' ? 'Можно удалённо.' : scheduleRaw;

    const company = getElByAttr('vacancy-serp__vacancy-employer');
    const address = getElByAttr('vacancy-serp__vacancy-address');
    const city = address.split(',')[0];

    const dateMonthDay = getElByAttr(
      'vacancy-serp__vacancy-date',
      '.vacancy-serp-item__publication-date_short'
    );
    const bumpedAt = dayjs.utc(dateMonthDay, 'DD-MM').unix();
    const bumpedAgo = dayjs().to(dayjs.unix(bumpedAt));
    const content = [title, company, salaryStr, tasks, skills, schedule].join('\n');
    const hashContent = getHashByStr(content);

    const cachedCreatedAt = await redisCache.get(`HH:vacancyCreatedAt:${hashContent}`);
    const createdAt =
      cachedCreatedAt ?? dayjs(bumpedAt).isBefore(dayjs().subtract(1, 'day'))
        ? bumpedAt
        : dayjs().unix();
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
      bumpedAt,
      createdAt,
      bumpedAgo,
      // content,
      hashContent,
      ago: ago === 'a few seconds ago' ? 'a minute ago' : ago,
      source: 'HEADHUNTER',
    });
  }

  return { vacanciesDataRaw, vacanciesCount };
};
