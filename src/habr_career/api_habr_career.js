import dayjs from 'dayjs';
import dayjsRelativeTime from 'dayjs/plugin/relativeTime.js';
// import LRU from 'lru-cache';
import dotenv from 'dotenv';
import _ from 'lodash';
import qs from 'qs';
import RssParser from 'rss-parser';
import { URL } from 'url';
import { parseSalaryFromTitleRaw } from '../utils/api_currency.js';
import { delayMs, getHashByStr } from '../utils/utils.js';

dotenv.config();
// export const cache = new LRU({
//   max: 2000,
//   maxAge: 1000 * 60 * 60 * 24, // 24 hours
// });

dayjs.extend(dayjsRelativeTime);

const rss = new RssParser();

const HABR_CAREER_BASE_URL = 'https://career.habr.com';
const HABR_CAREER_URL_RSS = `${HABR_CAREER_BASE_URL}/vacancies/rss`;

export const getVacancyByFilterFromRssHabrCareer = async (
  filterParam,
  redisCache,
  fromDayAgo = 14
) => {
  console.log('getVacancyByFilterFromRssHabrCareer', { fromDayAgo });

  let filter = filterParam;
  if (typeof filter === 'string') {
    filter = qs.parse(new URL(filter).search.slice(1));
  }
  const urlRss = new URL(
    `${HABR_CAREER_URL_RSS}?${qs.stringify(filter, { arrayFormat: 'brackets' })}`
  );
  urlRss.searchParams.set('sort', 'date');

  let vacancyCount = Infinity;
  let isOlderThanFromDayAgo = false;
  let page = 1;
  const vacancies = [];

  while (vacancyCount && !isOlderThanFromDayAgo) {
    urlRss.searchParams.set('page', page);
    const keyCache = decodeURI(urlRss);
    console.log('request vacancies Habr.Career', keyCache);

    let feed = null;

    if (await redisCache.exists(keyCache)) {
      feed = JSON.parse(await redisCache.get(keyCache));
    } else {
      feed = await rss.parseURL(urlRss.toString());

      await redisCache.set(
        keyCache,
        JSON.stringify(feed),
        'EX',
        page <= 6 ? 60 * Math.round(4 + page ** 3.5) : 60 * 60 * 24
      ); // 5, 15, 50, 132, 283 минут

      await delayMs(process.env.DELAY_INTERVAL_HABR_CAREER_REQUEST || 2_000);
    }

    vacancyCount = feed.items.length;

    if (feed.items.length) {
      console.log('Получено:', vacancyCount, feed.title);
      isOlderThanFromDayAgo = dayjs(
        feed.items[vacancyCount - 1].isoDate
      ).isBefore(dayjs().subtract(fromDayAgo, 'day'));
      vacancies.push(...feed.items);
      page += 1;
    }
  }

  return vacancies
    .map(({ title, content, author, isoDate, link, guid }) => ({
      title,
      content,
      hashContent: getHashByStr(content),
      author,
      isoDate,
      link,
      guid,
    }))
    .filter(({ isoDate }) =>
      dayjs(isoDate).isAfter(dayjs().subtract(fromDayAgo, 'day'))
    );
};

const TAGS_START_TITLE = 'Требуемые навыки: ';
const regExpPatternContentVacancy =
  /((?:(?:от)\s+(?:(?:\d[\s\d]*\d)+)\s+[^\s]{1,4}\s*)(?:(?:до)\s*(?:(?:\d[\s\d]*\d)+)\s*[^\s]{1,4})){1}|((?:(?:от)\s+(?:(?:\d[\s\d]*\d)+)\s+[^\s]{1,4}\s*)|(?:(?:до)\s*(?:(?:\d[\s\d]*\d)+)\s*[^\s]{1,4})){1}/i;

const parseSalaryFromTitleHabr = (stringTitleVacancy, baseCurrency, rates) => {
  const regExpPatternSalary =
    /(?:(от)\s*(?:(\d[\s\d]*\d)+)\s*)?(?:(до)\s*(?:(\d[\s\d]*\d)+)\s*)?(.)\)$/;

  const salary = stringTitleVacancy.match(regExpPatternSalary);
  if (!salary) {
    return null;
  }
  const [, , rawMin, , rawMax, rawCurrencySymbol] = salary;
  if (!rawMin && !rawMax) {
    return null;
  }
  return parseSalaryFromTitleRaw(
    baseCurrency,
    rates,
    rawMin,
    rawMax,
    rawCurrencySymbol
  );
};

export const parseFilterFormatVacancies = async (
  vacanciesRaw,
  rates,
  baseCurrency = 'RUB',
  vacancyExcludeTags,
  vacancyExcludeWordsInDesc,
  maxCountIncludesBadTag = 0,
  maxCountIncludesBadWord = 0,
  minSalary = 0,
  maxSalary = Infinity
) => {
  const vacancyExcludeTagsLC = vacancyExcludeTags.map((tag) =>
    tag.toLowerCase()
  );
  const vacancyExcludeWordsInDescLC = vacancyExcludeWordsInDesc.map((word) =>
    word.toLowerCase()
  );

  const vacancies = Array.from(vacanciesRaw)
    .filter((vacancy) => vacancy.title)
    .map((vacancy) => {
      const salaryData = parseSalaryFromTitleHabr(
        vacancy.title,
        baseCurrency,
        rates
      );
      let salary = {
        isSalaryDefine: false,
        avg: null,
        avgUSD: null,
        fork: null,
        forkUSD: null,
      };

      if (salaryData) {
        salary = {
          avg: salaryData.avg,
          avgUSD: salaryData.avgUSD,
          fork: salaryData.fork,
          forkUSD: salaryData.forkUSD,
          isSalaryDefine: true,
        };
      }

      // const textDesc = String(vacancy.content).slice(
      //   0,
      //   vacancy.content.indexOf(TAGS_START_TITLE) - 1
      // );

      const tags = String(vacancy.content)
        .slice(
          vacancy.content.indexOf(TAGS_START_TITLE) + TAGS_START_TITLE.length,
          -1
        )
        .split(', ')
        .map((tag) => tag.slice(1));

      const ago = dayjs(dayjs(vacancy.isoDate)).fromNow();
      const titleShort = vacancy.title.match(/^Требуется «([^»]+?)»/)[1];

      return {
        ...vacancy,
        titleShort,
        date: dayjs(vacancy.isoDate),
        ago: ago === 'a few seconds ago' ? 'a minute ago' : ago,
        salary,
        tags,
        tagsLowerCase: tags.map((tag) => tag.toLowerCase()),
        source: 'HABR_CAREER',
        text: [titleShort, vacancy.author, tags].join('\n'),
      };
    });

  const vacanciesFilteredRaw = vacancies.filter(
    ({ tagsLowerCase, titleShort }) => {
      const wordsTitles = _.words(titleShort.toLowerCase());

      const countBadTag = vacancyExcludeTagsLC.reduce(
        (sum, badTag) => sum + tagsLowerCase.includes(badTag),
        0
      );
      const countBadWord = vacancyExcludeWordsInDescLC.reduce(
        (sum, badWord) => sum + wordsTitles.includes(badWord),
        0
      );
      // console.log('countBadTag <= maxCountIncludesBadTag', { countBadTag, maxCountIncludesBadTag });
      return (
        countBadTag <= maxCountIncludesBadTag &&
        countBadWord <= maxCountIncludesBadWord
      );
    }
  );

  const vacanciesFiltered = vacanciesFilteredRaw
    .filter(
      ({ salary: { avg, isSalaryDefine } }) =>
        !isSalaryDefine || (avg >= minSalary && avg <= maxSalary)
    )
    .sort(({ salary: { avgUSD: A } }, { salary: { avgUSD: B } }) => B - A);

  return { vacanciesFiltered, vacancies };
};

export const getStringifyVacancies = (vacanciesFiltered) =>
  vacanciesFiltered.map(
    ({
      content,
      author,
      titleShort,
      ago,
      salary: { fork, avgUSD, isSalaryDefine },
      link,
      tags,
    }) => {
      const contentFormat = content
        .replace(/.+»\. /, '')
        .replace(regExpPatternContentVacancy, '')
        .replace(/ Требуемые навыки:.*$/, '');

      const salaryOut = isSalaryDefine
        ? `${fork} (~${avgUSD} $)`
        : '_Не указана_';

      const tagsStr = tags.map((tag) => `#${tag}`).join(', ');
      const linkB = link
        .split('career.habr')
        .join('*career.habr*')
        .split('://')[1];
      const authorR = author.replace(/[_$*]/g, '-');
      const titleShortR = titleShort.replace(/[_$*]/g, '-');
      const contentFormatR = contentFormat.replace(/[_$*]/g, '-');
      return `${salaryOut} | ${ago} | «${authorR}» | *«${titleShortR}»* | ${tagsStr} | _${contentFormatR}_ ► ${linkB}`;
    }
  );

export const getTopTagsByCount = (vacancies) => {
  const tagsVacancies = vacancies.flatMap(({ tagsLowerCase }) => tagsLowerCase);
  const topTagsByCount = Object.fromEntries(
    Object.entries(_.countBy(tagsVacancies)).sort(([, vA], [, vB]) => vB - vA)
  );
  return topTagsByCount;
};
