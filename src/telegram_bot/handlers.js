/* eslint-disable no-useless-escape */
import { URL } from 'url';
import _ from 'lodash';
import { markdownEscapes } from 'markdown-escapes';
import getRss from '../habr_career/index.js';
import { botStartMessage, commandDescription, initStateUsers } from './settings.js';

const markdownRegexp = new RegExp(`([${markdownEscapes.join('')}])`);
const mapUserIdToState = { ...initStateUsers };

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

  await ctx.replyWithMarkdown(
    '_Потом вы можете посмотреть список добавленных искл. тегов командой_ */extags*'
  );
  ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
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

  if (!mapUserIdToState[userId].pollOptions) {
    mapUserIdToState[userId].pollOptions = {};
  }
  for (const pollOptions of chunkedTags) {
    if (pollOptions.length < 2) {
      break;
    }
    const { poll } = await ctx.telegram.sendPoll(
      ctx.chat.id,
      'Выберите теги, вакансии с которыми исключить из выдачи',
      pollOptions,
      {
        allows_multiple_answers: true,
        is_anonymous: false,
        disable_notification: true,
      }
    );

    mapUserIdToState[userId].pollOptions[poll.id] = pollOptions;
  }
};

const getVacancy = async (ctx, isSub = false, isFirstSub = false) => {
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
  if (isSub) {
    if (!mapUserIdToState[userId].hashes) {
      mapUserIdToState[userId].hashes = new Set();
    }
    const existHashes = mapUserIdToState[userId].hashes;
    try {
      const { hashes, vacanciesFiltered, getStringifyVacancies } = await getRss(
        rss,
        3,
        mapUserIdToState[userId].excludeTags
      );
      console.log('вакансии получены', vacanciesFiltered.length);
      const newHashes = hashes.filter((vac) => !existHashes.has(vac));

      if (!newHashes.length) {
        console.log('нет новых вакансий');
        return;
      }

      for (const newVac of newHashes) {
        mapUserIdToState[userId].hashes.add(newVac);
      }
      if (isFirstSub) {
        ctx.telegram.webhookReply = true;
        return;
      }
      ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');

      const newVacancy = newHashes.map((hash) =>
        vacanciesFiltered.find(({ hashContent }) => hashContent === hash)
      );
      const newVacanciesStr = getStringifyVacancies(newVacancy);
      const message = newVacanciesStr.join('\n\n');

      if (Buffer.byteLength(message, 'utf8') >= 4096) {
        for (const messageChunk of _.chunk(newVacanciesStr, 10)) {
          await ctx.reply(messageChunk.join('\n\n'), {
            disable_web_page_preview: true,
            webhookReply: false,
            disable_notification: true,
          });
        }
        ctx.telegram.webhookReply = true;
        return;
      }
      ctx.reply(message, { disable_web_page_preview: true, disable_notification: true });
    } catch (error) {
      console.log(error);
    }
    return;
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

const handlers = {
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
    // {
    //   command: '/ex_words',
    //   description: 'add words, vacancies with which in description will be excluded',
    // },
    // {
    //   command: '/ex_words_add',
    //   description: 'add words, vacancies with which in description will be excluded',
    // },
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
        ctx.reply('Для начала установите RSS ссылку */rss*');
        return;
      }

      ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
      if (!mapUserIdToState[userId].excludeTags.length === 0) {
        ctx.replyWithMarkdown(
          'Ваш список исключаемых тегов пуст. Вы можете добавить их командой */extagsset*'
        );
        return;
      }
      const tagsStr = mapUserIdToState[userId].excludeTags
        // eslint-disable-next-line prettier/prettier
        .map((tag) => `  \`#${tag.replace(markdownRegexp, '\$1')}\``)
        .join('\n');

      ctx.replyWithMarkdown(
        `*Ваши исключаемые теги:*\n${tagsStr}\n\nВы можете добавить в список ещё */extagsadd* (или задать заново */extagsset*)`,
        { disable_web_page_preview: true }
      );
    },
    extagsadd: async (ctx) => {
      await setExcludeTags(ctx, true);
    },
    get: async (ctx) => {
      await getVacancy(ctx);
    },
    sub: async (ctx) => {
      const userId = ctx.update.message.from.id;
      const rss = mapUserIdToState[userId]?.rss;

      if (!rss) {
        ctx.replyWithMarkdown('RSS not found! Please add that with */rss* [link]');
        console.log('user id', userId, 'not found rss');
        return;
      }
      ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
      await getVacancy(ctx, true, true);

      mapUserIdToState[userId].subIntervalId = setInterval(() => {
        getVacancy(ctx, true);
        // }, 1000 * 60 * 60 * 1 / 2); // раз в полчаса
      }, 1000 * 60 * 5); // раз в 5 минуту
      // }, 1000 * 20); // раз в 30 сек

      ctx.replyWithMarkdown(
        'Вы успешно *подписаны* на уведомления о новых вакансий!\nОтписаться можно командой */unsub*'
      );
    },
    unsub: async (ctx) => {
      const userId = ctx.update.message.from.id;
      const subId = mapUserIdToState[userId]?.subIntervalId;

      if (!subId) {
        ctx.replyWithMarkdown('Вы не подписаны!\nПодписаться можно командой */sub*');
        console.log('user id', userId, 'not found sub id');
        return;
      }

      clearInterval(subId);
      ctx.replyWithMarkdown(
        'Вы успешно *отписаны* от уведомления о новых вакансий!\nПодписаться снова можно командой */sub*'
      );
      console.log('user id', userId, 'unsub success');
    },
  },
  on: {
    text: async (ctx) => {
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
      if (!mapUserIdToState[poll.user.id]?.pollOptions) {
        return;
      }
      const excludeTags = poll.option_ids.map(
        (index) => mapUserIdToState[poll.user.id].pollOptions[poll.poll_id][index]
      );
      mapUserIdToState[poll.user.id].excludeTags = [
        ...mapUserIdToState[poll.user.id].excludeTags,
        ...excludeTags,
      ];
      console.log(mapUserIdToState[poll.user.id].excludeTags);
    },
  },
};

export default handlers;
