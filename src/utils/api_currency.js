import axios from 'axios';
import currencyFormatter from 'currency-formatter';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import currencySymbols from './currency_symbols.js';

dotenv.config();

export const redisStore = new Redis({
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  family: 4, // 4 (IPv4) or 6 (IPv6)
  password: process.env.REDIS_PASS,
  db: 0,
  // maxRetriesPerRequest: 1,
});

export const mapCurrencyCodeToSymbol = Object.fromEntries(
  currencySymbols.map(({ symbol, code }) => [code, symbol])
);
export const mapSymbolToCurrencyCode = Object.fromEntries(
  currencySymbols.map(({ symbol, code }) => [symbol, code])
);

export const getCurrencyRates = async (isTest = false) => {
  const ratesFallback = { RUB: 90, USD: 1 };
  let rates = ratesFallback;

  if (isTest) {
    return rates;
  }

  try {
    if (await redisStore.get('rates:rates')) {
      const ratesFromCache = JSON.parse(await redisStore.get('rates:rates'));
      rates = ratesFromCache;
    } else {
      const res = await axios.get('http://data.fixer.io/api/latest', {
        params: { access_key: process.env.FIXER_API_KEY },
      });
      const { rates: ratesNew } = res.data;

      if (!ratesNew) {
        console.log('error getCurrencyRates data null', res.data);
      } else {
        await redisStore.set(
          'rates:rates',
          JSON.stringify(ratesNew),
          'EX',
          60 * 60 * 24
        ); // 1 day
        rates = ratesNew;
      }
    }
  } catch (error) {
    console.log('error getCurrencyRates', error);
  }

  console.log('\nrates USD->RUB', rates.RUB / rates.USD);

  return rates;
};

export const convertCurrencyToBase = (rates, base = 'RUB') => {
  const baseRate = rates[base];
  const rateByBase = Object.entries(rates).reduce((acc, [currency, rate]) => {
    acc[currency] = baseRate / rate;
    return acc;
  }, {});

  return rateByBase;
};

export const getNumberFromCurrency = (num, currencyCode) =>
  currencyFormatter.unformat(num, { code: currencyCode });

export const convertCurrency = (numberPrice, rates, fromCode, toCode) => {
  const rate = rates[toCode] / rates[fromCode];

  return Math.floor(numberPrice * rate);
};

export const parseSalaryFromTitleRaw = (
  baseCurrency,
  rates,
  rawMin,
  rawMax,
  rawCurrencySymbol
) => {
  const USD = 'USD';
  const baseCurrencySymbol = mapCurrencyCodeToSymbol[baseCurrency];
  const currencySymbol = String(rawCurrencySymbol).trim();

  const currency = mapSymbolToCurrencyCode[currencySymbol] ?? currencySymbol;

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
  const strFork = isExistFork
    ? `${minF}–${maxF}`
    : rawMin
      ? `>${minF}`
      : `<${maxF}`;
  // eslint-disable-next-line no-nested-ternary
  const strForkUSD = isExistFork
    ? `${minUSD}–${maxUSD}`
    : rawMin
      ? `>${minUSD}`
      : `<${maxUSD}`;
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
    isSalaryDefine: true,
  };
};
