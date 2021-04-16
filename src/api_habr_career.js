import 'dotenv/config.js';
import RssParser from 'rss-parser';
import { URL } from 'url';
import qs from 'qs';
import _ from 'lodash';
import dayjs from 'dayjs';
import dayjsRelativeTime from 'dayjs/plugin/relativeTime.js';
import { delayMs } from './utils.js';
import {
  mapCurrencyCodeToSymbol,
  mapSymbolToCurrencyCode,
  getCurrencyRates,
  getNumberFromCurrency,
  convertCurrency,
} from './api_currency.js';

dayjs.extend(dayjsRelativeTime);

const rss = new RssParser();

const HABR_CAREER_BASE_URL = 'https://career.habr.com';
const HABR_CAREER_URL_RSS = `${HABR_CAREER_BASE_URL}/vacancies/rss`;

export const getVacancyByFilterFromRssHabrCareer = async (filterParam, fromDayAgo = 14) => {
  let filter = filterParam;
  if (typeof filter === 'string') {
    filter = qs.parse(new URL(filter).search.slice(1));
  }
  const urlRss = new URL(
    `${HABR_CAREER_URL_RSS}?${qs.stringify(filter, { arrayFormat: 'brackets' })}`
  );
  let vacancyCount = true;
  let isOlderThanFromDayAgo = false;
  let page = 1;
  const vacancies = [];

  while (vacancyCount && !isOlderThanFromDayAgo) {
    urlRss.searchParams.set('page', page);
    console.log(decodeURI(urlRss));

    const feed = await rss.parseURL(urlRss.toString());
    vacancyCount = feed.items.length;
    console.log('Получено:', vacancyCount, feed.title);
    isOlderThanFromDayAgo = dayjs(feed.items[vacancyCount - 1].isoDate).isBefore(
      dayjs().subtract(fromDayAgo, 'day')
    );
    vacancies.push(...feed.items);
    page += 1;
    await delayMs(1000);
  }

  return vacancies
    .map(({ title, content, author, isoDate, link, guid }) => ({
      title,
      content,
      author,
      isoDate,
      link,
      guid,
    }))
    .filter(({ isoDate }) => dayjs(isoDate).isAfter(dayjs().subtract(fromDayAgo, 'day')));
};

const TAGS_START_TITLE = 'Требуемые навыки: ';

const parseSalaryFromTitle = (stringTitleVacancy, baseCurrency, rates) => {
  const USD = 'USD';
  const baseCurrencySymbol = mapCurrencyCodeToSymbol[baseCurrency];
  const regExpPattern = /(?:(от)\s*(?:(\d[\s\d]*\d)+)\s*)?(?:(до)\s*(?:(\d[\s\d]*\d)+)\s*)?(.)\)$/;

  const [, , rawMin, , rawMax, rawCurrencySymbol] = stringTitleVacancy.match(regExpPattern);
  const currencySymbol = String(rawCurrencySymbol).trim();

  const currency = mapSymbolToCurrencyCode[currencySymbol];
  // if (rawCurrencySymbol === '$') {
  //   console.log({ currencyCode, rateConvertCurrency });
  // }
  const isExistFork = rawMin && rawMax;
  const min = convertCurrency(
    getNumberFromCurrency(rawMin, currency),
    rates,
    currency,
    baseCurrency
  );
  const max = convertCurrency(
    getNumberFromCurrency(rawMax, currency),
    rates,
    currency,
    baseCurrency
  );

  const minUSD = convertCurrency(min, rates, currency, USD);
  const maxUSD = convertCurrency(max, rates, currency, USD);

  const minF = `${Math.floor(min / 1000)}k`;
  const maxF = `${Math.floor(max / 1000)}k`;
  // eslint-disable-next-line no-nested-ternary
  const strFork = isExistFork ? `${minF}–${maxF}` : rawMin ? `>${minF}` : `<${maxF}`;
  // eslint-disable-next-line no-nested-ternary
  const strForkUSD = isExistFork ? `${minUSD}–${maxUSD}` : rawMin ? `>${minUSD}` : `<${maxUSD}`;
  // eslint-disable-next-line no-nested-ternary
  const avg = !isExistFork
    ? max
      ? (max + max * 0.8) / 2
      : (min * 1.15 + min) / 2
    : (max + min) / 2;
  // const avgFormat = `${Math.floor(avg / 1000)} тыс.`;
  const avgUSD = convertCurrency(avg, rates, baseCurrency, USD);

  return {
    raw: {
      rawCurrencySymbol,
      baseCurrencySymbol,
      avg,
      avgUSD,
      min,
      max,
    },
    avg,
    avgUSD,
    fork: `${strFork} ${baseCurrencySymbol}`,
    forkUSD: `${strForkUSD} $`,
  };
};

export const parseFilterFormatVacancies = async (
  vacanciesRaw,
  baseCurrency = 'RUB',
  vacancyExcludeTags,
  vacancyExcludeWordsInDesc,
  maxCountIncludesBadTag = 0,
  maxCountIncludesBadWord = 0,
  maxSalary = Infinity
) => {
  const vacancyExcludeTagsLC = vacancyExcludeTags.map((tag) => tag.toLowerCase());
  const vacancyExcludeWordsInDescLC = vacancyExcludeWordsInDesc.map((word) => word.toLowerCase());

  const rates = await getCurrencyRates();

  const vacancies = vacanciesRaw.map((vacancy) => {
    const salaryData = parseSalaryFromTitle(vacancy.title, baseCurrency, rates);
    const salary = {
      avg: salaryData.avg,
      avgUSD: salaryData.avgUSD,
      fork: salaryData.fork,
      forkUSD: salaryData.forkUSD,
    };

    const tags = String(vacancy.content)
      .slice(vacancy.content.indexOf(TAGS_START_TITLE) + TAGS_START_TITLE.length, -1)
      .split(', ')
      .map((tag) => tag.slice(1));

    return {
      ...vacancy,
      date: dayjs(vacancy.isoDate),
      ago: dayjs().to(dayjs(vacancy.isoDate)),
      salary,
      tags,
      tagsLowerCase: tags.map((tag) => tag.toLowerCase()),
    };
  });

  const vacanciesFiltered = vacancies
    .filter(({ tagsLowerCase, title }) => {
      const countBadTag = vacancyExcludeTagsLC.reduce(
        (sum, badTag) => sum + tagsLowerCase.includes(badTag),
        0
      );
      const countBadWord = vacancyExcludeWordsInDescLC.reduce(
        (sum, badTag) => sum + _.words(title.toLowerCase()).includes(badTag),
        0
      );
      // console.log('countBadTag <= maxCountIncludesBadTag', { countBadTag, maxCountIncludesBadTag });
      return countBadTag <= maxCountIncludesBadTag && countBadWord <= maxCountIncludesBadWord;
    })
    .filter(({ salary: { avg } }) => avg < maxSalary)
    .sort(({ salary: { avgUSD: A } }, { salary: { avgUSD: B } }) => B - A);

  const stringVacancies = vacanciesFiltered
    .map(
      ({ content, ago, salary: { fork, avgUSD }, link }) =>
        `${fork} (~${avgUSD} $) | ${ago} | ${content} \n${link}`
    )
    .join('\n\n');
  const tagsVacancies = vacancies.flatMap(({ tagsLowerCase }) => tagsLowerCase);
  const topTagsByCount = Object.fromEntries(
    Object.entries(_.countBy(tagsVacancies)).sort(([, vA], [, vB]) => vB - vA)
  );

  return { vacanciesFiltered, stringVacancies, topTagsByCount };
};
