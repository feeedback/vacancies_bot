import 'dotenv/config.js';
import fs from 'fs';
import axios from 'axios';
import _ from 'lodash';
import currencyFormatter from 'currency-formatter';
import dayjs from 'dayjs';
import currencySymbols from '../data/currency.js';

export const mapCurrencyCodeToSymbol = Object.fromEntries(
  currencySymbols.map(({ symbol, code }) => [code, symbol])
);
export const mapSymbolToCurrencyCode = Object.fromEntries(
  currencySymbols.map(({ symbol, code }) => [symbol, code])
);

export const getCurrencyRates = async () => {
  const res = await axios.get('http://data.fixer.io/api/latest', {
    params: { access_key: process.env.FIXER_API_KEY },
  });

  return res.data.rates;
};

export const convertCurrencyToBase = (rates, base = 'RUB') => {
  const baseRate = rates[base];
  const rateByBase = Object.entries(rates).reduce(
    (acc, [currency, rate]) => ({ ...acc, [currency]: baseRate / rate }),
    {}
  );

  return rateByBase;
};

export const getNumberFromCurrency = (num, currencyCode) =>
  currencyFormatter.unformat(num, { code: currencyCode });

export const convertCurrency = (numberPrice, rates, fromCode, toCode) => {
  const rate = rates[fromCode] / rates[toCode];

  return Math.floor(numberPrice * rate);
};

const main = async (baseCurrency = 'RUB') => {
  const USD = 'USD';
  const baseCurrencySymbol = mapCurrencyCodeToSymbol[baseCurrency];

  const vacanciesRaw = fs.readFileSync(filepath, 'utf8');
  const regExpPattern = /(?:(от)\s*(?:(\d[\s\d]*\d)+)\s*)?(?:(до)\s*(?:(\d[\s\d]*\d)+)\s*)?(.)\)$/;

  const rates = await getCurrencyRates();
  const vacancies = JSON.parse(vacanciesRaw)
    .map((vacancy) => {
      const [, , rawMin, , rawMax, rawCurrencySymbol] = vacancy.title.match(regExpPattern);
      const currencySymbol = String(rawCurrencySymbol).trim();

      const currency = mapSymbolToCurrencyCode[currencySymbol];
      // if (rawCurrencySymbol === '$') {
      //   console.log({ currencyCode, rateConvertCurrency });
      // }
      const isExistFork = rawMin && rawMax;
      const min = convertCurrency(
        getNumberFromCurrency(rawMin, currency),
        rates,
        baseCurrency,
        currency
      );
      const max = convertCurrency(
        getNumberFromCurrency(rawMax, currency),
        rates,
        baseCurrency,
        currency
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
      const avgUSD = convertCurrency(avg, rates, currency, USD);

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
