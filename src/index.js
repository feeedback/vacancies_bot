import 'dotenv/config.js';
import RssParser from 'rss-parser';
import { URL } from 'url';
import qs from 'qs';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import _ from 'lodash';
import currencyFormatter from 'currency-formatter';
import dayjs from 'dayjs';
import dayjsRelativeTime from 'dayjs/plugin/relativeTime.js';
import currencySymbols from '../data/currency.js';
import vacancyExcludeTags from '../data/exclude_tags.js';
import vacancyExcludeWordsInDesc from '../data/exclude_words_desc.js';
import { delayMs, __dirname } from './utils.js';

dayjs.extend(dayjsRelativeTime);
const vacancyExcludeTagsLC = vacancyExcludeTags.map((tag) => tag.toLowerCase());
const vacancyExcludeWordsInDescLC = vacancyExcludeWordsInDesc.map((word) => word.toLowerCase());
const mapCurrencyCodeToSymbol = Object.fromEntries(
  currencySymbols.map(({ symbol, code }) => [code, symbol])
);
const mapSymbolToCurrencyCode = Object.fromEntries(
  currencySymbols.map(({ symbol, code }) => [symbol, code])
);

const rss = new RssParser();

const HABR_CAREER_BASE_URL = 'https://career.habr.com';
const HABR_CAREER_URL_RSS = `${HABR_CAREER_BASE_URL}/vacancies/rss`;

const getCurrencyRates = async () => {
  const res = await axios.get('http://data.fixer.io/api/latest', {
    params: { access_key: process.env.FIXER_API_KEY },
  });

  return res.data.rates;
};

const convertCurrencyToBase = (rates, base = 'RUB') => {
  const baseRate = rates[base];
  const rateByBase = Object.entries(rates).reduce(
    (acc, [currency, rate]) => ({ ...acc, [currency]: baseRate / rate }),
    {}
  );

  return rateByBase;
};

const filterVacanciesSearch = {
  currency: 'RUR',
  divisions: ['apps', 'software', 'backend', 'frontend'],
  salary: '40000',
  skills: ['264'], // javascript
  sort: 'date', // 'salary_asc',
  type: 'all',
  with_salary: 'true',
};

const getVacancyByFilterFromRssHabrCareer = async (filter, fromDayAgo = 14) => {
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

  return vacancies.map(({ title, content, author, isoDate, link, guid }) => ({
    title,
    content,
    author,
    isoDate,
    link,
    guid,
  }));
};

const filepath = path.resolve(__dirname, '../data', 'vacancy_rss_full.json');

getVacancyByFilterFromRssHabrCareer(filterVacanciesSearch, 14).then((data) =>
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
);

const tagsTitle = 'Требуемые навыки: ';
const getNumberFromCurrency = (num, currencyCode) =>
  currencyFormatter.unformat(num, { code: currencyCode });

// console.log(currencyFormatter.unformat('1 700', { symbol: '$' }));
const main = async (baseCurrencyCode = 'RUB') => {
  const baseCurrencySymbol = mapCurrencyCodeToSymbol[baseCurrencyCode];
  const currencyRates = await getCurrencyRates();
  const currencyRatesByRUB = convertCurrencyToBase(currencyRates, baseCurrencyCode);
  const currencyRatesByUSD = convertCurrencyToBase(currencyRates, 'USD');
  const vacanciesRaw = fs.readFileSync(filepath, 'utf8');
  const regExpPattern = /(?:(от)\s*(?:(\d[\s\d]*\d)+)\s*)?(?:(до)\s*(?:(\d[\s\d]*\d)+)\s*)?(.)\)$/;

  const vacancies = JSON.parse(vacanciesRaw)
    .map((vacancy) => {
      const [, , rawMin, , rawMax, rawCurrencySymbol] = vacancy.title.match(regExpPattern);
      const currencySymbol = String(rawCurrencySymbol).trim();

      const currencyCode = mapSymbolToCurrencyCode[currencySymbol];
      const rateConvertCurrency = currencyRatesByRUB[currencyCode];
      // if (rawCurrencySymbol === '$') {
      //   console.log({ currencyCode, rateConvertCurrency });
      // }
      const isExistFork = rawMin && rawMax;
      const min = Math.floor(getNumberFromCurrency(rawMin, currencyCode) * rateConvertCurrency);
      const max = Math.floor(getNumberFromCurrency(rawMax, currencyCode) * rateConvertCurrency);

      const minUSD = Math.floor(currencyRatesByUSD[baseCurrencyCode] * min);
      const maxUSD = Math.floor(currencyRatesByUSD[baseCurrencyCode] * max);

      const minFormat = `${Math.floor(min / 1000)}k`;
      const maxFormat = `${Math.floor(max / 1000)}k`;
      // eslint-disable-next-line no-nested-ternary
      const strFork = isExistFork
        ? `${minFormat}–${maxFormat}`
        : rawMin
          ? `>${minFormat}`
          : `<${maxFormat}`;
      // eslint-disable-next-line no-nested-ternary
      const strForkUSD = isExistFork ? `${minUSD}–${maxUSD}` : rawMin ? `>${minUSD}` : `<${maxUSD}`;
      const avg = !isExistFork
        ? max
          ? (max + max * 0.8) / 2
          : (min * 1.15 + min) / 2
        : (max + min) / 2;
      // const avgFormat = `${Math.floor(avg / 1000)} тыс.`;
      const avgUSD = Math.floor(currencyRatesByUSD[baseCurrencyCode] * avg);
      const tags = String(vacancy.content)
        .slice(vacancy.content.indexOf(tagsTitle) + tagsTitle.length, -1)
        .split(', ')
        .map((tag) => tag.slice(1));
      return {
        ...vacancy,
        // title: vacancy.title,
        date: dayjs(vacancy.pubDate),
        ago: dayjs().to(dayjs(vacancy.pubDate)),
        salary: {
          // raw: {
          //   rawCurrencySymbol,
          //   avg: !isExistFork ? null : (max + min) / 2,
          //   min,
          //   max,
          // },
          avg,
          avgUSD,
          fork: `${strFork} ${baseCurrencySymbol}`,
          forkUSD: `${strForkUSD} $`,
        },
        tags,
        tagsLowerCase: tags.map((tag) => tag.toLowerCase()),
      };
    })
    .filter(
      ({ tagsLowerCase, title }) =>
        !vacancyExcludeTagsLC.some((badTag) => tagsLowerCase.includes(badTag)) &&
        !vacancyExcludeWordsInDescLC.some((badWord) =>
          _.words(title.toLowerCase()).includes(badWord)
        )
    )
    .sort(({ salary: { avgUSD: A } }, { salary: { avgUSD: B } }) => B - A)
    .filter(({ salary: { avg } }) => avg < 200000)
    .map(
      ({ content, ago, salary: { fork, avgUSD }, link }) =>
        `${fork} (~${avgUSD} $) | ${ago} | ${content} \n${link}`
    )
    .join('\n\n');
  // const tagsVacancies = vacancies.flatMap(({ tagsLowerCase }) => tagsLowerCase);
  // const tagsByCountIncludes = Object.fromEntries(
  //   Object.entries(_.countBy(tagsVacancies)).sort(([, vA], [, vB]) => vB - vA)
  // );

  return vacancies;
};
// main().then((res) => console.log(res));
