/* eslint-disable no-param-reassign */
/* eslint-disable no-useless-escape */
import { URL } from 'url';
import _ from 'lodash';
import { markdownEscapes } from 'markdown-escapes';
import getRss from '../habr_career/index.js';
import { botStartMessage, commandDescription, initStateUsers } from './settings.js';
import { nowMsDate } from '../utils/utils.js';

const markdownRegexp = new RegExp(`([${markdownEscapes.join('')}])`);

export const mapUserIdToState = { ...initStateUsers };
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
  if (!mapUserIdToState[userId]) {
    mapUserIdToState[userId] = {};
  }

  mapUserIdToState[userId].rss = rss;
  await ctx.reply('Saved your RSS successful!');
  console.log('user id', userId, 'rss saved', rss);
};

const setExcludeTags = async (ctx, isSaveOld = false) => {
  const userId = ctx.update.message.from.id;
  if (!mapUserIdToState[userId]) {
    mapUserIdToState[userId] = {};
  }
  if (!mapUserIdToState[userId].rss) {
    ctx.replyWithMarkdown('Для начала установите RSS ссылку, командой */rss*');
    return;
  }

  if (!mapUserIdToState[userId]?.excludeTags) {
    mapUserIdToState[userId].excludeTags = [];
  }

  if (!isSaveOld) {
    mapUserIdToState[userId].excludeTags = [];
  }
  ctx.telegram.webhookReply = false;
  await ctx.replyWithMarkdown(
    '_Потом вы можете посмотреть список добавленных искл. тегов командой_ */extags*'
  );
  await ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
  const { topTagsByCount, topTagsByCountByFiltered } = await getRss(
    mapUserIdToState[userId].rss,
    10
  );
  // await ctx.poll([topTagsByCount]);
  // await ctx.telegram.sendPoll(ctx.chatId: string | number, question: string, options: topTagsByCount, extra ?: ExtraPoll)
  const topTags = Object.entries(isSaveOld ? topTagsByCountByFiltered : topTagsByCount)
    .filter(([, count]) => count >= 2)
    .map(([tag]) => tag);

  const chunkedTags = _.chunk(topTags, 10);

  if (!mapUserIdToState[userId].pollOptionsExTags) {
    mapUserIdToState[userId].pollOptionsExTags = {};
  }
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
  if (!mapUserIdToState[userId]) {
    mapUserIdToState[userId] = {};
  }
  if (!mapUserIdToState[userId].rss) {
    ctx.replyWithMarkdown('Для начала установите RSS ссылку, командой */rss*');
    return;
  }

  if (!mapUserIdToState[userId]?.excludeWords) {
    mapUserIdToState[userId].excludeWords = [];
  }

  if (!isSaveOld) {
    mapUserIdToState[userId].excludeWords = [];
  }
  ctx.telegram.webhookReply = false;
  await ctx.replyWithMarkdown(
    '_Потом вы можете посмотреть список добавленных искл. слов командой_ */exwords*'
  );
  await ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
  const { topWordsByCount, topWordsByCountByFiltered } = await getRss(
    mapUserIdToState[userId].rss,
    10
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
  const userId = ctx.update.message.from.id;
  const rss = mapUserIdToState[userId]?.rss;

  if (!rss) {
    ctx.replyWithMarkdown('RSS not found! Please add that with */rss* [link]');
    console.log('user id', userId, 'not found rss');
    return;
  }
  ctx.telegram.webhookReply = false;

  if (!mapUserIdToState[userId].excludeTags.length === 0) {
    ctx.replyWithMarkdown(
      '_Ваш список исключаемых тегов пуст. Вы можете добавить их командой */extagsset*_'
    );
  }

  const dayRaw = ctx.update.message.text.slice(5).trim();
  let day = Number(dayRaw);
  if (!dayRaw) {
    day = 2;
  }
  ctx.reply('Идет обработка вакансий, пожалуйста, подождите несколько секунд...');
  ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');

  try {
    const { stringVacancies, vacanciesFiltered } = await getRss(
      rss,
      day,
      mapUserIdToState[userId].excludeTags
    );
    console.log('вакансии получены', vacanciesFiltered.length);
    const message = stringVacancies.join('\n\n');

    if (Buffer.byteLength(message, 'utf8') >= 4096) {
      for (const messageChunk of _.chunk(stringVacancies, 10)) {
        await ctx.reply(messageChunk.join('\n\n'), {
          disable_web_page_preview: true,
          webhookReply: false,
          disable_notification: true,
        });
      }
      ctx.telegram.webhookReply = true;
      return;
    }
    ctx.reply(message, {
      disable_web_page_preview: true,
      disable_notification: true,
    });
  } catch (error) {
    console.log(error);
  }

  const tempMessageId = ctx.message.message_id + 1;
  ctx.deleteMessage(tempMessageId);
};

const getVacancySub = async (bot, chatId, userId, isFirstSub = false) => {
  console.log('\n', nowMsDate(), getVacancySub);
  // const userId = ctx.update.message.from.id;
  const rss = mapUserIdToState[userId]?.rss;

  if (!rss) {
    sendMD(bot, chatId, 'RSS not found! Please add that with */rss* [link]');
    console.log('user id', userId, 'not found rss');
    return;
  }
  bot.telegram.webhookReply = false;

  if (!mapUserIdToState[userId].excludeTags.length === 0) {
    sendMD(
      bot,
      chatId,
      '_Ваш список исключаемых тегов пуст. Вы можете добавить их командой */extagsset*_'
    );
  }

  if (!mapUserIdToState[userId].hashes) {
    mapUserIdToState[userId].hashes = new Set();
  }
  const existHashes = mapUserIdToState[userId].hashes;

  try {
    const { hashes, vacanciesFiltered, getStringifyVacancies } = await getRss(
      rss,
      isFirstSub ? 7 : 4,
      mapUserIdToState[userId].excludeTags
    );
    console.log('вакансии получены', vacanciesFiltered.length);
    const newHashes = hashes.filter((vac) => !existHashes.has(vac));

    if (!newHashes.length) {
      console.log('getVacancySub нет новых вакансий');
      mapUserIdToState[userId].subIntervalId = setTimeout(() => {
        getVacancySub(bot, chatId, userId);
      }, 1000 * 60 * 5); // раз в 5 минуту
      return;
    }

    console.log('getVacancySub получены новые вакансии -', newHashes.length);
    for (const newVac of newHashes) {
      mapUserIdToState[userId].hashes.add(newVac);
    }
    if (isFirstSub) {
      console.log('getVacancySub isFirstSub -> return');
      bot.telegram.webhookReply = true;
      return;
    }
    bot.telegram.sendChatAction(chatId, 'typing');

    const newVacancy = newHashes.map((hash) =>
      vacanciesFiltered.find(({ hashContent }) => hashContent === hash)
    );
    const newVacanciesStr = getStringifyVacancies(newVacancy);
    const message = newVacanciesStr.join('\n\n');

    if (Buffer.byteLength(message, 'utf8') >= 4096) {
      for (const messageChunk of _.chunk(newVacanciesStr, 10)) {
        await bot.telegram.sendMessage(chatId, messageChunk.join('\n\n'), {
          disable_web_page_preview: true,
          // disable_notification: true,
          // webhookReply: false,
        });
      }
      bot.telegram.webhookReply = true;
    } else {
      bot.telegram.sendMessage(chatId, message, {
        disable_web_page_preview: true,
        // disable_notification: true,
      });
    }

    mapUserIdToState[userId].subIntervalId = setTimeout(() => {
      getVacancySub(bot, chatId, userId);
    }, 1000 * 30); // раз в 5 минуту
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
  start: (ctx) => ctx.replyWithMarkdown(botStartMessage.join('\n')),
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
      if (ctx.update.message.text.trim() === '/rss') {
        const message = await ctx.reply(
          'Пожалуйста, скопируйте сюда RSS ссылку из поиска с Вашим фильтром из https://career.habr.com/vacancies',
          { disable_web_page_preview: true }
        );
        const userId = ctx.update.message.from.id;
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
      if (!mapUserIdToState[userId]?.excludeTags) {
        mapUserIdToState[userId].excludeTags = [];
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
      if (!mapUserIdToState[userId]?.excludeWords) {
        mapUserIdToState[userId].excludeWords = [];
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
      const rss = mapUserIdToState[userId]?.rss;

      ctx.telegram.sendChatAction(chatId, 'typing');

      if (!rss) {
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
      await getVacancySub(bot, chatId, userId, true);

      mapUserIdToState[userId].subIntervalId = setTimeout(() => {
        getVacancySub(bot, chatId, userId);
      }, 1000 * 60 * 5); // раз в 5 минуты
      // }, 1000 * 20); // раз в 30 сек
    },
    unsub: async (ctx) => {
      const userId = ctx.update.message.from.id;

      if (!mapUserIdToState[userId].isSub) {
        ctx.replyWithMarkdown('Вы не подписаны!\nПодписаться можно командой */sub*');
        console.log('user id', userId, 'not found sub id');
        return;
      }
      const subId = mapUserIdToState[userId].subIntervalId;
      clearInterval(subId);
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

      if (mapUserIdToState[userId]?.pollOptionsExTags?.[poll.poll_id]) {
        if (!mapUserIdToState[userId]?.pollOptionsExTags) {
          return;
        }
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

      if (mapUserIdToState[userId]?.pollOptionsExWords?.[poll.poll_id]) {
        if (!mapUserIdToState[userId]?.pollOptionsExWords) {
          return;
        }
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
