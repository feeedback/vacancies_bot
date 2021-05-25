/* eslint-disable no-param-reassign */
/* eslint-disable no-useless-escape */
import { URL } from 'url';
import _ from 'lodash';
import dayjs from 'dayjs';
import { markdownEscapes } from 'markdown-escapes';
import getVacanciesHabrCareer from '../habr_career/index.js';
import getVacanciesHeadHunter from '../headhunter/index.js';
import { botStartMessage, commandDescription, initStateUsers } from './settings.js';
import { nowMsDate, chunkTextBlocksBySizeByte } from '../utils/utils.js';

const markdownRegexp = new RegExp(`([${markdownEscapes.join('')}])`);

export const mapUserIdToState = { ...initStateUsers };
// export const mapUserIdToState = {};

const startingUserState = (userId) => {
  let userState = mapUserIdToState[userId];

  if (!userState) {
    mapUserIdToState[userId] = {};
    userState = {};
  }

  mapUserIdToState[userId].excludeTags = userState.excludeTags ?? [];
  mapUserIdToState[userId].excludeWords = userState.excludeWords ?? [];
  mapUserIdToState[userId].subIntervalId = userState.subIntervalId ?? [];
  mapUserIdToState[userId].hashes = userState.hashes ?? new Set();
  mapUserIdToState[userId].pollOptionsExTags = userState.pollOptionsExTags ?? {};
  mapUserIdToState[userId].pollOptionsExWords = userState.pollOptionsExWords ?? {};

  mapUserIdToState[userId].HH = userState.HH ?? {};
  userState.HH = userState.HH ?? {};

  mapUserIdToState[userId].HH.filter = userState.HH.filter ?? {};
  mapUserIdToState[userId].HH.words = userState.HH.words ?? {};

  userState.isStarted = true;
};

const sendMD = (bot, chatId, msg) =>
  bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });

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
    ctx.reply('Invalid RSS url, need starts with "https://career.habr.com/vacancies/rss"', {
      disable_web_page_preview: true,
    });
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
    ctx.replyWithMarkdown('Для начала установите RSS ссылку, командой */rss*');
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
  const { topTagsByCount, topTagsByCountByFiltered } = await getVacanciesHabrCareer(
    mapUserIdToState[userId].rss,
    20,
    mapUserIdToState[userId].excludeTags,
    mapUserIdToState[userId].excludeWords
  );
  // await ctx.poll([topTagsByCount]);
  // await ctx.telegram.sendPoll(ctx.chatId: string | number, question: string, options: topTagsByCount, extra ?: ExtraPoll)
  const topTags = Object.entries(isSaveOld ? topTagsByCountByFiltered : topTagsByCount)
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
    ctx.replyWithMarkdown('Для начала установите RSS ссылку, командой */rss*');
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
  const { topWordsByCount, topWordsByCountByFiltered } = await getVacanciesHabrCareer(
    mapUserIdToState[userId].rss,
    20,
    mapUserIdToState[userId].excludeTags,
    mapUserIdToState[userId].excludeWords
  );
  // await ctx.poll([topTagsByCount]);
  // await ctx.telegram.sendPoll(ctx.chatId: string | number, question: string, options: topTagsByCount, extra ?: ExtraPoll)
  const topWords = Object.entries(isSaveOld ? topWordsByCountByFiltered : topWordsByCount)
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

const getVacancy = async (ctx) => {
  console.log('\n', nowMsDate(), getVacancy);
  const userId = ctx.update.message.from.id;
  const userState = mapUserIdToState[userId];

  if (!userState?.isStarted) {
    startingUserState(userId);
  }
  const rss = userState?.rss;

  if (!rss) {
    ctx.replyWithMarkdown('RSS not found! Please add that with */rss* [link]');
    console.log('user id', userId, 'not found rss');
    return;
  }
  ctx.telegram.webhookReply = false;

  if (!userState.excludeTags.length === 0) {
    ctx.replyWithMarkdown(
      '_Ваш список исключаемых тегов пуст. Вы можете добавить их командой */extagsset*_'
    );
  }

  const dayRaw = ctx.update.message.text.slice(5).trim();
  let day = Number(dayRaw);
  if (!dayRaw) {
    day = 2;
  }
  // await ctx.reply('Идет обработка вакансий, пожалуйста, подождите несколько секунд...');
  ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');

  try {
    const { stringVacancies, vacanciesFiltered } = await getVacanciesHabrCareer(
      rss,
      day,
      userState.excludeTags,
      userState.excludeWords
    );

    console.log('вакансии получены Habr.career', vacanciesFiltered.length);

    const dayUnix = dayjs()
      .startOf('day')
      .subtract(day - 1, 'day')
      .unix();
    const {
      stringVacancies: stringVacanciesHH,
      vacanciesFiltered: vacanciesFilteredHH,
    } = await getVacanciesHeadHunter(dayUnix, userState.HH.filter, userState.HH.words);

    console.log('вакансии получены HeadHunter', vacanciesFilteredHH.length);
    const allVacancies = [...stringVacancies, ...stringVacanciesHH];

    for (const messageChunk of chunkTextBlocksBySizeByte(allVacancies, 4096)) {
      ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');

      await ctx.reply(messageChunk.join('\n\n'), {
        disable_web_page_preview: true,
        webhookReply: false,
        disable_notification: true,
        parse_mode: 'Markdown',
      });
    }

    ctx.telegram.webhookReply = true;
  } catch (error) {
    console.log(error);
  }

  // const tempMessageId = ctx.message.message_id + 1;
  // ctx.deleteMessage(tempMessageId);
};

const getVacancySub = async (bot, chatId, userId, isFirstSub = false, intervalPingMs) => {
  console.log('\n', nowMsDate(), getVacancySub);
  // const userId = ctx.update.message.from.id;
  const userState = mapUserIdToState[userId];
  const rss = userState?.rss;

  if (!rss) {
    sendMD(bot, chatId, 'RSS not found! Please add that with */rss* [link]');
    console.log('user id', userId, 'not found rss');
    return;
  }
  bot.telegram.webhookReply = false;

  userState.subIntervalId.push(
    setTimeout(async () => {
      await getVacancySub(bot, chatId, userId, false, intervalPingMs);
    }, intervalPingMs)
  ); // раз в 5 минуту

  if (!userState.excludeTags.length === 0) {
    sendMD(
      bot,
      chatId,
      '_Ваш список исключаемых тегов пуст. Вы можете добавить их командой */extagsset*_'
    );
  }

  const existHashes = userState.hashes;

  try {
    const { hashes, vacanciesFiltered, getStringifyVacancies } = await getVacanciesHabrCareer(
      rss,
      isFirstSub ? 7 : 4,
      userState.excludeTags,
      userState.excludeWords
    );
    console.log('фильтрованные вакансии Habr.career', vacanciesFiltered.length);

    const dayUnix = dayjs()
      .subtract(intervalPingMs + 5000, 'ms')
      .unix();

    const {
      vacanciesFiltered: vacanciesFilteredHH,
      getStringifyVacancies: getStringifyVacanciesHH,
      hashes: hashesHH,
    } = await getVacanciesHeadHunter(dayUnix, userState.HH.filter, userState.HH.words);

    console.log('фильтрованные вакансии HeadHunter', vacanciesFilteredHH.length);

    const newHashes = [...hashes, ...hashesHH].filter((vac) => !existHashes.has(vac));

    if (!newHashes.length) {
      console.log('getVacancySub нет новых вакансий');
      return;
    }

    console.log('getVacancySub получены новые вакансии -', newHashes.length);
    for (const newVac of newHashes) {
      userState.hashes.add(newVac);
    }
    if (isFirstSub) {
      console.log('getVacancySub isFirstSub -> return');
      bot.telegram.webhookReply = true;

      return;
    }
    bot.telegram.sendChatAction(chatId, 'typing');

    const allVacancies = [...vacanciesFiltered, ...vacanciesFilteredHH];
    const newVacancy = newHashes.map((hash) =>
      allVacancies.find(({ hashContent }) => hashContent === hash)
    );
    const newVacanciesStr = [
      ...getStringifyVacancies(newVacancy.filter((v) => v.source === 'HABR_CAREER')),
      ...getStringifyVacanciesHH(newVacancy.filter((v) => v.source === 'HEADHUNTER')),
    ];

    for (const messageChunk of chunkTextBlocksBySizeByte(newVacanciesStr, 4096)) {
      await bot.telegram.sendMessage(chatId, messageChunk.join('\n\n'), {
        disable_web_page_preview: true,
        parse_mode: 'Markdown',
        // disable_notification: true,
        // webhookReply: false,
      });
    }
    bot.telegram.webhookReply = true;
  } catch (error) {
    console.log(error);
  }
};

export const getHandlers = (
  /** @type {Telegraf<import("telegraf").Context<import("typegram").Update>>} */ bot
) => ({
  use: [
    async (ctx, next) => {
      const d = Date.now();
      try {
        await next(); // runs next middleware
      } catch (error) {
        console.log(error);
        console.log(error.stack);
      }

      console.log(`Processing`, Date.now() - d, 'ms');
      console.log('');
    },
  ],
  start: (ctx) => {
    const userId = ctx.update.message.from.id;
    startingUserState(userId);

    ctx.replyWithMarkdown(botStartMessage.join('\n'));
  },
  settings: async (ctx) => {
    await ctx.setMyCommands(commandDescription);
  },
  help: async (ctx) => {
    const commands = await ctx.getMyCommands();
    const info = commands.reduce((acc, val) => `${acc}/${val.command} - ${val.description}\n`, '');
    return ctx.reply(info);
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
        ctx.replyWithMarkdown(
          'Ваш список исключаемых тегов пуст. Вы можете добавить их командой */extagsset*'
        );
        return;
      }
      const tagsStr = mapUserIdToState[userId].excludeTags
        // eslint-disable-next-line prettier/prettier
        .map((tag) => `  \`#${tag.replace(markdownRegexp, '$1')}\``)
        .join('\n');

      ctx.replyWithMarkdown(
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
        ctx.replyWithMarkdown(
          'Ваш список исключаемых слов пуст. Вы можете добавить их командой */exwordsset*'
        );
        return;
      }
      const wordsStr = mapUserIdToState[userId].excludeWords
        // eslint-disable-next-line prettier/prettier
        .map((word) => `  \`${word.replace(markdownRegexp, '$1')}\``)
        .join('\n');

      ctx.replyWithMarkdown(
        `*Ваши исключаемые слова:*\n${wordsStr}\n\nВы можете добавить в список ещё */exwordsadd* (или задать заново */exwordsset*)`,
        { disable_web_page_preview: true }
      );
    },
    exwordsadd: async (ctx) => {
      await setExcludeWords(ctx, true);
    },

    get: async (ctx) => {
      await getVacancy(ctx);
    },
    sub: async (ctx) => {
      const userId = ctx.update.message.from.id;
      const chatId = ctx.update.message.chat.id;
      if (!mapUserIdToState[userId]?.isStarted) {
        startingUserState(userId);
      }
      ctx.telegram.sendChatAction(chatId, 'typing');

      if (!mapUserIdToState[userId].rss) {
        ctx.replyWithMarkdown('RSS not found! Please add that with */rss* [link]');
        console.log('user id', userId, 'not found rss');
        return;
      }

      if (mapUserIdToState[userId].isSub) {
        ctx.replyWithMarkdown('Вы *уже подписаны*!\nОтписаться можно командой */unsub*');
        console.log('user id', userId, 'sub fail - yet sub');
        return;
      }

      ctx.replyWithMarkdown(
        'Вы успешно *подписаны* на уведомления о новых вакансий!\nОтписаться можно командой */unsub*'
      );
      console.log('user id', userId, 'sub success');
      mapUserIdToState[userId].isSub = true;
      await getVacancySub(bot, chatId, userId, true, 1000 * 60 * 10);
    },
    unsub: async (ctx) => {
      const userId = ctx.update.message.from.id;
      if (!mapUserIdToState[userId]?.isStarted) {
        startingUserState(userId);
      }
      if (!mapUserIdToState[userId].isSub) {
        ctx.replyWithMarkdown('Вы не подписаны!\nПодписаться можно командой */sub*');
        console.log('user id', userId, 'not found sub id');
        return;
      }

      for (const subId of mapUserIdToState[userId].subIntervalId) {
        clearInterval(subId);
      }
      mapUserIdToState[userId].isSub = false;

      ctx.replyWithMarkdown(
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
          (index) => mapUserIdToState[userId].pollOptionsExTags[poll.poll_id][index]
        );
        mapUserIdToState[userId].excludeTags = [
          ...mapUserIdToState[userId].excludeTags,
          ...excludeTags,
        ];
        console.log('excludeTags updated', mapUserIdToState[userId].excludeTags);
        return;
      }

      if (mapUserIdToState[userId].pollOptionsExWords[poll.poll_id]) {
        const excludeWords = poll.option_ids.map(
          (index) => mapUserIdToState[userId].pollOptionsExWords[poll.poll_id][index]
        );
        mapUserIdToState[userId].excludeWords = [
          ...mapUserIdToState[userId].excludeWords,
          ...excludeWords,
        ];
        console.log('excludeWords updated', mapUserIdToState[userId].excludeWords);
      }
    },
  },
});

export const unsubAll = () => {
  const intervalIds = Object.values(mapUserIdToState)
    .map((userState) => userState.subIntervalId)
    .filter((id) => Number.isInteger(id));

  for (const subId of intervalIds) {
    clearInterval(subId);
  }
};
