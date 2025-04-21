/* eslint-disable import/no-mutable-exports */
/* eslint-disable no-param-reassign */
/* eslint-disable no-useless-escape */

import dayjs from 'dayjs';
import dotenv from 'dotenv';
import { writeFile } from 'fs/promises';
import Redis from 'ioredis';
import _ from 'lodash';
import { markdownEscapes } from 'markdown-escapes';
import { URL } from 'url';
import { getStringifyVacancies as getStringifyVacanciesHabrCareer } from '../habr_career/api_habr_career.js';
import getVacanciesHabrCareer from '../habr_career/index.js';
import { getStringifyVacancies as getStringifyVacanciesHH } from '../headhunter/api_hh.js';
import getVacanciesHeadHunter from '../headhunter/index.js';
import { MIN_SALARY_DEFAULT } from '../utils/constant.js';
import {
  chunkTextBlocksBySizeByte,
  delayMs,
  // getTopWordsByCountFromVacanciesDataByField,
  getTopWordsByCountFromVacanciesDataByFieldSalary,
  nowMsDate,
} from '../utils/utils.js';
import {
  botStartMessage,
  commandDescription,
  initStateUsers,
} from './settings.js';

// import { filterNotWord } from '../utils/words.js';

dotenv.config();

// const INTERVAL_POLL_SUB_MS = 1000 * 60 * 10;
const INTERVAL_POLL_SUB_MS =
  (process.env.INTERVAL_POLL_SUB_MINUTE || 10) * 60 * 1000;
console.log('INTERVAL_POLL_SUB_MS', INTERVAL_POLL_SUB_MS / 1000 / 60);

export const redisStore = new Redis({
  port: process.env.REDIS_PORT, // Redis port
  host: process.env.REDIS_HOST, // Redis host
  family: 4, // 4 (IPv4) or 6 (IPv6)
  password: process.env.REDIS_PASS,
  db: 0,
  // maxRetriesPerRequest: 1,
});
export let mapUserIdToState = { ...initStateUsers };

const markdownRegexp = new RegExp(`([${markdownEscapes.join('')}])`);

// export const mapUserIdToState = await redisStore.get('mapUserIdToState', mapUserIdToState) || initStateUsers;

const startingUserState = (userId) => {
  let userState = mapUserIdToState[userId];

  if (!userState) {
    mapUserIdToState[userId] = {};
    userState = {};
  }

  mapUserIdToState[userId].excludeTags = userState.excludeTags ?? [];
  mapUserIdToState[userId].excludeWords = userState.excludeWords ?? [];
  mapUserIdToState[userId].subIntervalId = userState.subIntervalId ?? [];
  mapUserIdToState[userId].hashes = userState.hashes ?? [];
  mapUserIdToState[userId].pollOptionsExTags =
    userState.pollOptionsExTags ?? {};
  mapUserIdToState[userId].pollOptionsExWords =
    userState.pollOptionsExWords ?? {};

  mapUserIdToState[userId].HH = userState.HH ?? {};
  userState.HH = userState.HH ?? {};

  mapUserIdToState[userId].HH.filter = userState.HH.filter ?? {};
  mapUserIdToState[userId].HH.words = userState.HH.words ?? {};

  userState.isStarted = true;
};

// eslint-disable-next-line consistent-return
const sendMD = async (bot, chatId, msg) => {
  try {
    const res = await bot.telegram.sendMessage(chatId, msg.replace('`', ''), {
      parse_mode: 'Markdown',
    });
    return res;
  } catch (error) {
    console.log('sendMD error');
    console.error(error);
  }
};

const setRss = async (ctx, rss) => {
  let isValidURL = rss.startsWith('https://career.habr.com/vacancies/rss');
  try {
    // eslint-disable-next-line no-new
    new URL(rss);
  } catch (error) {
    isValidURL = false;
  }

  console.log(rss, isValidURL);
  if (!isValidURL) {
    ctx.reply(
      'Invalid RSS url, need starts with "https://career.habr.com/vacancies/rss"',
      {
        disable_web_page_preview: true,
      }
    );
    return;
  }

  const userId = ctx.update.message.from.id;

  mapUserIdToState[userId].rss = rss;
  await ctx.reply('Saved your RSS successful!');
  console.log('user id', userId, 'rss saved', rss);
};

const setExcludeTags = async (ctx, isSaveOld = false) => {
  const userId = ctx.update.message.from.id;
  if (!mapUserIdToState[userId]?.isStarted) {
    startingUserState(userId);
  }
  if (!mapUserIdToState[userId].rss) {
    await ctx.replyWithMarkdown(
      'Для начала установите RSS ссылку, командой */rss*'
    );
    return;
  }

  if (!isSaveOld) {
    mapUserIdToState[userId].excludeTags = [];
  }
  ctx.telegram.webhookReply = false;
  await ctx.replyWithMarkdown(
    '_Потом вы можете посмотреть список добавленных искл. тегов командой_ */extags*'
  );
  await ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
  const { topTagsByCount, topTagsByCountByFiltered } =
    await getVacanciesHabrCareer(
      mapUserIdToState[userId].rss,
      20,
      mapUserIdToState[userId].excludeTags,
      mapUserIdToState[userId].excludeWords,
      redisStore
    );
  // await ctx.poll([topTagsByCount]);
  // await ctx.telegram.sendPoll(ctx.chatId: string | number, question: string, options: topTagsByCount, extra ?: ExtraPoll)
  const topTags = Object.entries(
    isSaveOld ? topTagsByCountByFiltered : topTagsByCount
  )
    .filter(([, count]) => count >= 2)
    .map(([tag]) => tag);

  const chunkedTags = _.chunk(topTags, 10);

  for (const pollOptionsExTags of chunkedTags) {
    if (pollOptionsExTags.length < 2) {
      break;
    }
    ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
    const { poll } = await ctx.telegram.sendPoll(
      ctx.chat.id,
      'Выберите теги, вакансии с которыми исключить из выдачи',
      pollOptionsExTags,
      {
        allows_multiple_answers: true,
        is_anonymous: false,
        disable_notification: true,
      }
    );

    mapUserIdToState[userId].pollOptionsExTags[poll.id] = pollOptionsExTags;
  }
  ctx.telegram.webhookReply = true;
};

const setExcludeWords = async (ctx, isSaveOld = false) => {
  const userId = ctx.update.message.from.id;
  if (!mapUserIdToState[userId].rss) {
    await ctx.replyWithMarkdown(
      'Для начала установите RSS ссылку, командой */rss*'
    );
    return;
  }

  if (!isSaveOld) {
    mapUserIdToState[userId].excludeWords = [];
  }
  ctx.telegram.webhookReply = false;
  await ctx.replyWithMarkdown(
    '_Потом вы можете посмотреть список добавленных искл. слов командой_ */exwords*'
  );
  await ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
  const { topWordsByCount, topWordsByCountByFiltered } =
    await getVacanciesHabrCareer(
      mapUserIdToState[userId].rss,
      20,
      mapUserIdToState[userId].excludeTags,
      mapUserIdToState[userId].excludeWords,
      redisStore
    );
  // await ctx.poll([topTagsByCount]);
  // await ctx.telegram.sendPoll(ctx.chatId: string | number, question: string, options: topTagsByCount, extra ?: ExtraPoll)
  const topWords = Object.entries(
    isSaveOld ? topWordsByCountByFiltered : topWordsByCount
  )
    .filter(([, count]) => count >= 1)
    .map(([word]) => word);

  const chunkedWords = _.chunk(topWords, 10);

  if (!mapUserIdToState[userId].pollOptionsExWords) {
    mapUserIdToState[userId].pollOptionsExWords = {};
  }
  for (const pollOptionsExWords of chunkedWords) {
    if (pollOptionsExWords.length < 2) {
      break;
    }
    await ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
    const { poll } = await ctx.telegram.sendPoll(
      ctx.chat.id,
      'Выберите слова, вакансии с которыми исключить из выдачи',
      pollOptionsExWords,
      {
        allows_multiple_answers: true,
        is_anonymous: false,
        disable_notification: true,
      }
    );

    mapUserIdToState[userId].pollOptionsExWords[poll.id] = pollOptionsExWords;
  }
  ctx.telegram.webhookReply = true;
};

const checkUserPreparedForSearchVacancies = async (
  ctx,
  userId = ctx.update.message.from.id,
  bot,
  chatId
) => {
  console.log('\n', nowMsDate(), checkUserPreparedForSearchVacancies);

  const userState = mapUserIdToState[userId];

  if (!userState?.isStarted) {
    startingUserState(userId);
  }
  const rss = userState?.rss;
  const rss2 = userState?.rss2;
  const rss3 = userState?.rss3;
  const rssLinks = [rss, rss2, rss3].filter(Boolean);

  try {
    if (!rss) {
      if (!ctx) {
        await sendMD(
          bot,
          chatId,
          'RSS not found! Please add that with */rss* [link]'
        );
      } else {
        await ctx.replyWithMarkdown(
          'RSS not found! Please add that with */rss* [link]'
        );
      }
      console.log('user id', userId, 'not found rss');

      return {};
    }
    if (ctx) ctx.telegram.webhookReply = false;

    if (!userState.excludeTags.length === 0) {
      if (!ctx) {
        await sendMD(
          bot,
          chatId,
          '_Ваш список исключаемых тегов пуст. Вы можете добавить их командой */extagsset*_'
        );
      } else {
        await ctx.replyWithMarkdown(
          '_Ваш список исключаемых тегов пуст. Вы можете добавить их командой */extagsset*_'
        );
      }
    }
  } catch (error) {
    console.log(error);

    if (error.response && error.response.statusCode === 403) {
      console.log(error.response);

      delete mapUserIdToState[userId];
      await redisStore.set(
        'mapUserIdToState',
        JSON.stringify(mapUserIdToState)
      );
    }
  }

  return { userId, userState, rssLinks };
};

const stringifyVacancies = (vacancies) => [
  ...getStringifyVacanciesHabrCareer(
    vacancies.filter((v) => v.source === 'HABR_CAREER')
  ),
  ...getStringifyVacanciesHH(
    vacancies.filter((v) => v.source === 'HEADHUNTER')
  ),
];

const filterOnlyNewVacancies = async (allVacancies, hashes, existHashes) => {
  console.log('\n', nowMsDate(), filterOnlyNewVacancies);
  const newHashes = hashes.filter((vac) => !existHashes.includes(vac));

  const mapHashToVacancy = _.groupBy(allVacancies, 'hashContent');

  const newVacancies = newHashes.map((hash) => mapHashToVacancy[hash][0]);

  const newVacanciesStr = stringifyVacancies(newVacancies);

  return { newVacancies, newVacanciesStr, newHashes };
};

const getVacanciesFromSources = async (
  lastDays,
  lastDaysUnix,
  rssLinks,
  userState,
  source = 'ALL',
  minSalary = MIN_SALARY_DEFAULT,
  maxSalary = 1_000_000,
  addFiltersHH = {}
) => {
  console.log('\n', nowMsDate(), getVacanciesFromSources);

  const vacanciesFilteredHC = [];
  const hashesHC = [];

  if (source !== 'HH') {
    const { vacanciesFiltered, hashes } = await getVacanciesHabrCareer(
      rssLinks,
      lastDays,
      userState.excludeTags,
      userState.excludeWords,
      redisStore,
      minSalary,
      maxSalary
    );

    console.log('фильтрованные вакансии Habr.career', vacanciesFiltered.length);

    vacanciesFilteredHC.push(...vacanciesFiltered);
    hashesHC.push(...hashes);
  }

  const vacanciesFilteredHH = [];
  const hashesHH = [];
  if (source !== 'HC') {
    const { vacanciesFiltered, hashes } = await getVacanciesHeadHunter(
      lastDaysUnix,
      userState.HH.filter,
      userState.HH.words,
      redisStore,
      minSalary,
      maxSalary,
      addFiltersHH
    );

    console.log('фильтрованные вакансии HeadHunter', vacanciesFiltered.length);

    vacanciesFilteredHH.push(...vacanciesFiltered);
    hashesHH.push(...hashes);
  }

  const vacancies = [...vacanciesFilteredHC, ...vacanciesFilteredHH];
  const vacanciesStr = stringifyVacancies(vacancies);

  const hashes = [...hashesHC, ...hashesHH];

  return {
    vacanciesFilteredHC,
    vacanciesFilteredHH,
    vacancies,
    vacanciesStr,
    hashes,
  };
};

const getTopWordsFromDescriptionBySalary = async (ctx) => {
  // eslint-disable-next-line prefer-const
  let { userState, rssLinks } = await checkUserPreparedForSearchVacancies(ctx);
  if (!userState) return;

  rssLinks = rssLinks.map((rss) => `${rss}&with_salary=1`);

  const [, dayRaw = 2, sourceRaw = 'ALL'] = ctx.update.message.text
    .trim()
    .split(' ');
  const source = ['HH', 'HC', 'ALL'].includes(sourceRaw) ? sourceRaw : 'ALL';

  let day = Number(dayRaw);
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(dayRaw)) {
    day = 2;
  }
  const dayUnix = dayjs()
    .startOf('day')
    .subtract(day - 1, 'day')
    .unix();
  console.log('\n', nowMsDate(), getTopWordsFromDescriptionBySalary, {
    day,
    source,
  });

  // const { vacanciesFilteredHC, vacanciesFilteredHH } = await getVacanciesFromSources(
  const { vacanciesFilteredHH } = await getVacanciesFromSources(
    day,
    dayUnix,
    rssLinks,
    userState,
    'HH',
    1,
    2_000_000,
    // { only_with_salary: true, salary: 50000 }
    { only_with_salary: true }
  );

  // const {
  //   mapWordToSalariesPoints: mapWordToSalariesPointsHC,
  //   topWordsByCount: topWordsByCountByFilteredHC,
  // } = getTopWordsByCountFromVacanciesDataByFieldSalary(vacanciesFilteredHC, 'text');
  // const topWordsHC = Object.entries(topWordsByCountByFilteredHC)
  //   .filter(([word, count]) => word.length >= 2 && count >= 3)
  //   .filter(([word]) => filterNotWord(word))
  //   // .map(([word]) => word);
  //   .slice(0, 10);
  // console.log('topWords Habr.Career', topWordsHC);
  // console.log('mapWordToSalariesPoints Habr.Career', mapWordToSalariesPointsHC);

  //
  const {
    mapWordToSalariesPoints: mapWordToSalariesPointsHH,
    topWordsByCount: topWordsByCountByFilteredHH,
  } = getTopWordsByCountFromVacanciesDataByFieldSalary(
    vacanciesFilteredHH,
    'text'
  );
  // const topWordsHH = Object.entries(topWordsByCountByFilteredHH)
  //   .filter(([word, count]) => word.length >= 2 && count >= 3)
  //   .filter(([word]) => filterNotWord(word))
  //   .slice(0, 10);

  // console.log('topWords HH', topWordsHH.slice(0, 10));
  // console.log('mapWordToSalariesPoints HH', mapWordToSalariesPointsHH);

  await writeFile(
    `raw-top-words-by-count_by_N${vacanciesFilteredHH.length}.csv`,
    JSON.stringify(topWordsByCountByFilteredHH),
    { encoding: 'utf-8' }
  );

  await writeFile(
    `raw-words-and-salary_by_N${vacanciesFilteredHH.length}.csv`,
    JSON.stringify(mapWordToSalariesPointsHH),
    { encoding: 'utf-8' }
  );

  const mapWordToMeanSalary = Object.fromEntries(
    Object.entries(mapWordToSalariesPointsHH)
      .map(([word, salaries]) => [word, _.mean(salaries)])
      .sort(([, vA], [, vB]) => vB - vA)
  );
  // console.log('mapWordToMeanSalary HH', mapWordToMeanSalary);

  const data = Object.entries(mapWordToMeanSalary)
    .map(([word, meanSalary]) => [word, Math.round(meanSalary)].join(','))
    .join('\n');

  console.log('HH stat by count vacancy:', vacanciesFilteredHH.length);

  await writeFile(
    `word-by-salary_by_N${vacanciesFilteredHH.length}.csv`,
    data,
    {
      encoding: 'utf-8',
    }
  );
};

const getVacancy = async (ctx, { filterAndHighlight = false } = {}) => {
  const { userState, userId, rssLinks } =
    await checkUserPreparedForSearchVacancies(ctx);
  if (!userState) return;

  const [dayRaw = 2, sourceRaw = 'ALL', queryStringRaw = ''] =
    ctx.update.message.text
      .slice(filterAndHighlight ? 10 : 5)
      .trim()
      .split(' ');

  let queryString = queryStringRaw.trim();

  const source = ['HH', 'HC', 'ALL'].includes(sourceRaw) ? sourceRaw : 'ALL';

  if (filterAndHighlight && !queryString) {
    queryString = sourceRaw; // если нет второго слова, то третье (поисковая строка) это второе по порядку (вместо источника)
  }

  let day = Number(dayRaw);
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(dayRaw)) {
    day = 2;
  }
  const dayUnix = dayjs()
    .startOf('day')
    .subtract(day - 1, 'day')
    .unix();
  console.log('\n', nowMsDate(), getVacancy, { day, source });

  // await ctx.reply('Идет обработка вакансий, пожалуйста, подождите несколько секунд...');
  ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');

  try {
    const { vacanciesStr: vacanciesStrRaw } = await getVacanciesFromSources(
      day,
      dayUnix,
      rssLinks,
      userState,
      source
    );
    let vacanciesStr = vacanciesStrRaw;

    if (filterAndHighlight && queryString) {
      const queryStrTrimmed = queryString.toLowerCase().trim();

      const multipleQueryWords = queryStrTrimmed.split(',');

      console.log('[QueryWords] :', multipleQueryWords);

      vacanciesStr = vacanciesStr.filter((str) =>
        multipleQueryWords.every((queryWord) =>
          str.toLowerCase().includes(queryWord)
        )
      );
      // .map(str => str.replaceAll(new RegExp(queryString, 'gi'), (origCaseQueryString) => `<u>${origCaseQueryString}</u>`))
      // подчеркивание через <u> не работает при данном методе отсылки сообщений
    }

    const chunks = chunkTextBlocksBySizeByte(vacanciesStr, 4096);

    for (const messageChunk of chunks) {
      ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');

      await ctx.reply(messageChunk.join('\n\n').replace('`', ''), {
        disable_web_page_preview: true,
        webhookReply: false,
        disable_notification: true,
        parse_mode: 'Markdown',
      });

      if (chunks.length >= 10) {
        await delayMs(6_100);
      }
    }

    ctx.telegram.webhookReply = true;
  } catch (error) {
    console.log(error);

    if (error.response && error.response.statusCode === 403) {
      console.log(error.response);
      delete mapUserIdToState[userId];
      await redisStore.set(
        'mapUserIdToState',
        JSON.stringify(mapUserIdToState)
      );
    }
  }
  // const tempMessageId = ctx.message.message_id + 1;
  // ctx.deleteMessage(tempMessageId);
};

const getVacancySub = async (
  bot,
  chatId,
  userId,
  isFirstSub = false,
  intervalPingMs
) => {
  console.log('\n', nowMsDate(), getVacancySub);

  const { userState, rssLinks } = await checkUserPreparedForSearchVacancies(
    null,
    userId,
    bot,
    chatId
  );
  if (!userState) return;

  const day = isFirstSub ? 7 : 3;
  const dayUnix = (
    isFirstSub
      ? dayjs().subtract(7, 'day')
      : dayjs().subtract(intervalPingMs + 5000, 'ms')
  ).unix();

  try {
    const { vacancies, hashes } = await getVacanciesFromSources(
      day,
      dayUnix,
      rssLinks,
      userState,
      'ALL'
    );

    const { newVacanciesStr, newHashes } = await filterOnlyNewVacancies(
      vacancies,
      hashes,
      userState.hashes
    );

    if (!newHashes.length) {
      console.log('getVacancySub нет новых вакансий');

      await redisStore.set(`sub|${userId}`, dayjs().unix());
      return;
    }

    console.log('getVacancySub получены новые вакансии -', newHashes.length);
    for (const newVac of newHashes) {
      userState.hashes.push(newVac);
    }
    if (isFirstSub) {
      console.log('getVacancySub isFirstSub -> return');
      bot.telegram.webhookReply = true;

      await redisStore.set(`sub|${userId}`, dayjs().unix());
      return;
    }
    await bot.telegram.sendChatAction(chatId, 'typing');

    for (const messageChunk of chunkTextBlocksBySizeByte(
      newVacanciesStr,
      4096
    )) {
      await bot.telegram.sendMessage(
        chatId,
        messageChunk.join('\n\n').replace('`', ''),
        {
          disable_web_page_preview: true,
          parse_mode: 'Markdown',
          // disable_notification: true,
          // webhookReply: false,
        }
      );
    }
    bot.telegram.webhookReply = true;
  } catch (error) {
    console.log(error);

    if (error.response && error.response.statusCode === 403) {
      console.log(error.response);
      delete mapUserIdToState[userId];
      await redisStore.set(
        'mapUserIdToState',
        JSON.stringify(mapUserIdToState)
      );
    }
  }

  await redisStore.set(`sub|${userId}`, dayjs().unix());
};

export const getHandlers = async (
  /** @type {Telegraf<import("telegraf").Context<import("typegram").Update>>} */ bot
) => {
  (async () => {
    const cachedState = await redisStore.get('mapUserIdToState');

    // if (cachedState === 'ddddddddddddddddddddddddd') {
    if (cachedState) {
      try {
        const stateFromCache = JSON.parse(cachedState);

        Object.keys(stateFromCache).forEach((userId) => {
          stateFromCache[userId].HH.filter = initStateUsers[userId].HH.filter;
          stateFromCache[userId].rss = initStateUsers[userId].rss;

          console.log('filter', stateFromCache[userId].HH.filter);
        });

        mapUserIdToState = _.mergeWith(
          initStateUsers,
          stateFromCache,
          // eslint-disable-next-line consistent-return
          (objValue, srcValue) => {
            if (Array.isArray(objValue)) {
              return _.uniq(objValue.concat(srcValue));
            }
          }
        );

        console.log(mapUserIdToState);

        for (const [userId, userState] of Object.entries(mapUserIdToState)) {
          if (userState.isSub) {
            // const ttlSub = await redisStore.ttl(`sub|${userId}`);
            const timeLastPollSub = await redisStore.get(`sub|${userId}`);
            let lastTimeDiff = INTERVAL_POLL_SUB_MS;

            console.log(
              'Последний запуск был',
              dayjs.unix(timeLastPollSub).fromNow()
            );

            if (timeLastPollSub) {
              if (
                dayjs.unix(timeLastPollSub).isBefore(dayjs().subtract(3, 'day'))
              ) {
                console.log(
                  'Последний запрос вакансий (запуск программы и getVacancySub) было позже 3 дней назад, выводятся только новые вакансии с этого момента'
                );
              } else {
                lastTimeDiff = (dayjs().unix() - timeLastPollSub) * 1000;
              }
            }
            if (lastTimeDiff > INTERVAL_POLL_SUB_MS) {
              await getVacancySub(bot, +userId, +userId, false, lastTimeDiff);
            }
            // setTimeout(async () => {

            const newIntervalId = setInterval(async () => {
              await getVacancySub(
                bot,
                +userId,
                +userId,
                false,
                INTERVAL_POLL_SUB_MS
              );
            }, INTERVAL_POLL_SUB_MS);

            userState.subIntervalId.push(Number(newIntervalId)); // раз в 5 минуту
            // }, 0);
            // }, ttlSub || 0);
          }
        }
      } catch (error) {
        console.log(error);
        // await redisStore.del('mapUserIdToState');
      }
    }
  })();

  return {
    use: [
      async (ctx, next) => {
        const d = Date.now();
        try {
          console.log(
            '\n',
            nowMsDate(),
            `[COMMAND] ${ctx?.update?.message?.text?.trim()}`
          );

          await next(); // runs next middleware
        } catch (error) {
          console.log(error);
          console.log(error.stack);
        }

        console.log(`Processing`, Date.now() - d, 'ms');
        console.log('');
      },
    ],
    start: async (ctx) => {
      const userId = ctx.update.message.from.id;
      try {
        startingUserState(userId);
        await ctx.replyWithMarkdown(botStartMessage.join('\n'));
      } catch (error) {
        console.log('start', error);
        console.log(error.stack);

        if (error.response && error.response.statusCode === 403) {
          console.log(error.response);
          delete mapUserIdToState[userId];
          await redisStore.set(
            'mapUserIdToState',
            JSON.stringify(mapUserIdToState)
          );
        }
      }
    },
    settings: async (ctx) => {
      try {
        await ctx.setMyCommands(commandDescription);
      } catch (error) {
        console.log('settings', error);
        console.log(error.stack);

        const userId = ctx.update.message.from.id;
        if (error.response && error.response.statusCode === 403) {
          console.log(error.response);
          delete mapUserIdToState[userId];
          await redisStore.set(
            'mapUserIdToState',
            JSON.stringify(mapUserIdToState)
          );
        }
      }
    },
    // eslint-disable-next-line consistent-return
    help: async (ctx) => {
      try {
        const commands = await ctx.getMyCommands();
        const info = commands.reduce(
          (acc, val) => `${acc}/${val.command} - ${val.description}\n`,
          ''
        );
        return await ctx.reply(info);
      } catch (error) {
        console.log('help', error);
        console.log(error.stack);

        const userId = ctx.update.message.from.id;
        if (error.response && error.response.statusCode === 403) {
          console.log(error.response);
          delete mapUserIdToState[userId];
          await redisStore.set(
            'mapUserIdToState',
            JSON.stringify(mapUserIdToState)
          );
        }
      }
    },
    command: {
      rss: async (ctx) => {
        const userId = ctx.update.message.from.id;
        if (!mapUserIdToState[userId]?.isStarted) {
          startingUserState(userId);
        }

        if (ctx.update.message.text.trim() === '/rss') {
          const message = await ctx.reply(
            'Пожалуйста, скопируйте сюда RSS ссылку из поиска с Вашим фильтром из https://career.habr.com/vacancies',
            { disable_web_page_preview: true }
          );
          mapUserIdToState[userId].rssMessageID = message.message_id;
          return;
        }
        // если ссылка уже передана в команде
        const rss = ctx.update.message.text.slice(5).trim();
        await setRss(ctx, rss);
      },
      extagsset: async (ctx) => {
        await setExcludeTags(ctx);
      },
      extags: async (ctx) => {
        const userId = ctx.update.message.from.id;
        if (!mapUserIdToState[userId]?.isStarted) {
          startingUserState(userId);
        }

        ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
        if (mapUserIdToState[userId].excludeTags.length === 0) {
          await ctx.replyWithMarkdown(
            'Ваш список исключаемых тегов пуст. Вы можете добавить их командой */extagsset*'
          );
          return;
        }
        const tagsStr = mapUserIdToState[userId].excludeTags
          // eslint-disable-next-line prettier/prettier
          .map((tag) => `  \`#${tag.replace(markdownRegexp, '$1')}\``)
          .join('\n');

        await ctx.replyWithMarkdown(
          `*Ваши исключаемые теги:*\n${tagsStr}\n\nВы можете добавить в список ещё */extagsadd* (или задать заново */extagsset*)`,
          { disable_web_page_preview: true }
        );
      },
      extagsadd: async (ctx) => {
        await setExcludeTags(ctx, true);
      },
      exwordsset: async (ctx) => {
        await setExcludeWords(ctx);
      },
      exwords: async (ctx) => {
        const userId = ctx.update.message.from.id;
        if (!mapUserIdToState[userId]?.isStarted) {
          startingUserState(userId);
        }
        ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
        if (mapUserIdToState[userId].excludeWords.length === 0) {
          await ctx.replyWithMarkdown(
            'Ваш список исключаемых слов пуст. Вы можете добавить их командой */exwordsset*'
          );
          return;
        }
        const wordsStr = mapUserIdToState[userId].excludeWords
          // eslint-disable-next-line prettier/prettier
          .map((word) => `  \`${word.replace(markdownRegexp, '$1')}\``)
          .join('\n');

        await ctx.replyWithMarkdown(
          `*Ваши исключаемые слова:*\n${wordsStr}\n\nВы можете добавить в список ещё */exwordsadd* (или задать заново */exwordsset*)`,
          { disable_web_page_preview: true }
        );
      },
      exwordsadd: async (ctx) => {
        await setExcludeWords(ctx, true);
      },

      get: async (ctx) => {
        try {
          await getVacancy(ctx);
        } catch (error) {
          console.log('get() | ERROR', error);
        }
      },
      getfilter: async (ctx) => {
        try {
          await getVacancy(ctx, { filterAndHighlight: true });
        } catch (error) {
          console.log('getfilter() | ERROR', error);
        }
      },
      topwords: async (ctx) => {
        getTopWordsFromDescriptionBySalary(ctx).catch((err) =>
          console.log(err)
        );
      },
      sub: async (ctx) => {
        try {
          const userId = ctx.update.message.from.id;
          const chatId = ctx.update.message.chat.id;
          if (!mapUserIdToState[userId]?.isStarted) {
            startingUserState(userId);
          }
          ctx.telegram.sendChatAction(chatId, 'typing');

          if (!mapUserIdToState[userId].rss) {
            await ctx.replyWithMarkdown(
              'RSS not found! Please add that with */rss* [link]'
            );
            console.log('user id', userId, 'not found rss');
            return;
          }

          if (mapUserIdToState[userId].isSub) {
            await ctx.replyWithMarkdown(
              'Вы *уже подписаны*!\nОтписаться можно командой */unsub*'
            );
            console.log('user id', userId, 'sub fail - yet sub');
            return;
          }

          await ctx.replyWithMarkdown(
            'Вы успешно *подписаны* на уведомления о новых вакансий!\nОтписаться можно командой */unsub*'
          );
          console.log('user id', userId, 'sub success');
          mapUserIdToState[userId].isSub = true;

          const newIntervalId = setInterval(async () => {
            await getVacancySub(
              bot,
              chatId,
              userId,
              false,
              INTERVAL_POLL_SUB_MS
            );
          }, INTERVAL_POLL_SUB_MS);

          mapUserIdToState[userId].subIntervalId.push(Number(newIntervalId)); // раз в 5 минуту

          await getVacancySub(bot, chatId, userId, true, INTERVAL_POLL_SUB_MS);
        } catch (error) {
          console.log('sub() | ERROR', error);
        }
      },
      unsub: async (ctx) => {
        const userId = ctx.update.message.from.id;
        if (!mapUserIdToState[userId]?.isStarted) {
          startingUserState(userId);
        }
        if (!mapUserIdToState[userId].isSub) {
          await ctx.replyWithMarkdown(
            'Вы не подписаны!\nПодписаться можно командой */sub*'
          );
          console.log('user id', userId, 'not found sub id');
          return;
        }

        for (const subId of mapUserIdToState[userId].subIntervalId) {
          clearInterval(subId);
        }
        mapUserIdToState[userId].isSub = false;

        await ctx.replyWithMarkdown(
          'Вы успешно *отписаны* от уведомления о новых вакансий!\nПодписаться снова можно командой */sub*'
        );
        console.log('user id', userId, 'unsub success');
      },
    },
    onEvent: {
      textH: async (ctx) => {
        const userId = ctx.update.message.from.id;
        if (!mapUserIdToState[userId]?.isStarted) {
          startingUserState(userId);
        }
        const isRss = mapUserIdToState[userId]?.rssMessageID;

        if (isRss) {
          if (ctx.message.message_id === isRss + 1) {
            await setRss(ctx, ctx.update.message.text);
          } else {
            delete mapUserIdToState[userId].rssMessageID;
          }
        }
      },
      poll_answer: (ctx) => {
        const { poll_answer: poll } = ctx.update;

        if (poll.user.is_bot) {
          return;
        }
        const userId = poll.user.id;

        if (mapUserIdToState[userId].pollOptionsExTags[poll.poll_id]) {
          const excludeTags = poll.option_ids.map(
            (index) =>
              mapUserIdToState[userId].pollOptionsExTags[poll.poll_id][index]
          );
          mapUserIdToState[userId].excludeTags = [
            ...mapUserIdToState[userId].excludeTags,
            ...excludeTags,
          ];
          console.log(
            'excludeTags updated',
            mapUserIdToState[userId].excludeTags
          );
          return;
        }

        if (mapUserIdToState[userId].pollOptionsExWords[poll.poll_id]) {
          const excludeWords = poll.option_ids.map(
            (index) =>
              mapUserIdToState[userId].pollOptionsExWords[poll.poll_id][index]
          );
          mapUserIdToState[userId].excludeWords = [
            ...mapUserIdToState[userId].excludeWords,
            ...excludeWords,
          ];
          console.log(
            'excludeWords updated',
            mapUserIdToState[userId].excludeWords
          );
        }
      },
    },
  };
};

export const unsubAll = () => {
  const intervalIds = Object.values(mapUserIdToState)
    .flatMap((userState) => userState.subIntervalId)
    .filter((id) => Number.isInteger(+id));
  console.log('intervalIds', intervalIds);

  for (const subId of intervalIds) {
    clearInterval(subId);
  }
  // eslint-disable-next-line guard-for-in
  for (const userId in mapUserIdToState) {
    mapUserIdToState[userId].subIntervalId = [];
  }
};
