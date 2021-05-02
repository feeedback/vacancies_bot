import jsdom from 'jsdom';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js';
import dayjsRelativeTime from 'dayjs/plugin/relativeTime.js';
import dayjsUtc from 'dayjs/plugin/utc.js';

import LRU from 'lru-cache';
import { getHashByStr } from '../utils/utils.js';
import { parseSalaryFromTitleRaw } from '../utils/api_currency.js';

export const cacheHashVacancyCreatedAt = new LRU({
  max: 10000,
  maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
});

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsRelativeTime);
dayjs.extend(dayjsUtc);
const getDOMDocument = (data) => new jsdom.JSDOM(data).window.document;

const BASE_VACANCY_LINK = 'https://hh.ru/vacancy';

const parseSalaryFromTitleHH = (
  stringTitleVacancy,
  baseCurrency = 'RUB',
  rates = { RUB: 75, USD: 1 }
) => {
  const regExpPatternSalary = /(?:(?:^(?:от)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:до)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:(\d[\s\d]*\d)+)-(?:(\d[\s\d]*\d)+)))(?: (.+)$)/i;
  const mapCurrencyStrToSymbol = {
    'USD': '$',
    'руб.': '₽',
  };
  const [, rawMin, rawMax, rawFrom, rawTo, rawCurrencyStr] = stringTitleVacancy.match(
    regExpPatternSalary
  );
  const min = rawFrom ?? rawMin;
  const max = rawTo ?? rawMax;
  const rawCurrencySymbol = mapCurrencyStrToSymbol[rawCurrencyStr];
  return parseSalaryFromTitleRaw(baseCurrency, rates, min, max, rawCurrencySymbol);
};

export default (data, baseCurrency = 'RUB', rates = { RUB: 75, USD: 1 }, maxSalary = Infinity) => {
  const document = getDOMDocument(data);
  const vacanciesEl = [...document.querySelectorAll('.vacancy-serp-item')];
  console.log('vacancies count:', vacanciesEl.length);
  const getChildTextByDataAttr = (el, str, addStr = '', isText = true) => {
    const child = el.querySelector(`[data-qa="${str}"]${addStr ? `${` ${addStr}`}` : ''}`);
    return isText ? child?.textContent?.trim() : child;
  };

  const vacanciesData = vacanciesEl
    .map((vacancy) => {
      // console.log('vacancy', '№:', i);
      const getElByAttr = (attr, ...restArgs) => getChildTextByDataAttr(vacancy, attr, ...restArgs);

      const tasks = getElByAttr('vacancy-serp__vacancy_snippet_responsibility');
      const skills = getElByAttr('vacancy-serp__vacancy_snippet_requirement');
      const title = getElByAttr('vacancy-serp__vacancy-title');

      const id = getElByAttr('vacancy-serp__vacancy-title', '', false)
        .href.split('?')[0]
        .split('vacancy/')[1];
      const link = `${BASE_VACANCY_LINK}/${id}`;

      const salaryStr = getElByAttr('vacancy-serp__vacancy-compensation');
      let salary = null;
      if (salaryStr) {
        salary = parseSalaryFromTitleHH(salaryStr, baseCurrency, rates);
      }

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
      const content = [title, company, salaryStr, tasks, skills, schedule, city].join('\n');
      const hashContent = getHashByStr(content);

      const cachedCreatedAt = cacheHashVacancyCreatedAt.get(hashContent);

      const createdAt = cachedCreatedAt ?? dayjs().unix();
      const ago = dayjs().to(dayjs.unix(createdAt));

      if (!cachedCreatedAt) {
        cacheHashVacancyCreatedAt.set(hashContent, createdAt);
      }

      return {
        id,
        title,
        tasks,
        skills,
        link,
        salary,
        company,
        schedule,
        // address,
        city,
        bumpedAt,
        bumpedAgo,
        // content,
        hashContent,
        ago,
      };
    })
    .filter(({ salary: { avg } }) => avg < maxSalary)
    .sort(({ salary: { avgUSD: A } }, { salary: { avgUSD: B } }) => B - A);

  return vacanciesData;
};
