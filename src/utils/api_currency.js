import 'dotenv/config.js';
// import fs from 'fs';
import axios from 'axios';
// import _ from 'lodash';
import currencyFormatter from 'currency-formatter';
// import dayjs from 'dayjs';
import currencySymbols from '../../data/currency.js';

export const mapCurrencyCodeToSymbol = Object.fromEntries(
  currencySymbols.map(({ symbol, code }) => [code, symbol])
);
export const mapSymbolToCurrencyCode = Object.fromEntries(
  currencySymbols.map(({ symbol, code }) => [symbol, code])
);

export const getCurrencyRates = async (isTest = false) => {
  const ratesFallback = { RUB: 75, USD: 1 };
  if (isTest) {
    return { rates: ratesFallback };
  }
  try {
    const res = await axios.get('http://data.fixer.io/api/latest', {
      params: { access_key: process.env.FIXER_API_KEY },
    });

    const { rates, timestamp, date } = res.data;
    return { rates, timestamp, date };
  } catch (error) {
    console.log('error getCurrencyRates', error);
    return { rates: ratesFallback };
  }
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
  const rate = rates[toCode] / rates[fromCode];

  return Math.floor(numberPrice * rate);
};