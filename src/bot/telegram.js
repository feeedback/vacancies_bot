/* eslint-disable prettier/prettier */
import 'dotenv/config.js';
import { Telegraf } from 'telegraf';
import { URL } from 'url';
import _ from 'lodash';
import { markdownEscapes } from 'markdown-escapes';
import getRss from '../habr_career/index.js';
import vacancyExcludeTagsMy from '../../data/settings/exclude_tags.js';
import MY_SETTINGS from '../../data/settings/my_rss.js';
// import vacancyExcludeWordsInDescMy from '../data/exclude_words_desc.js';
const markdownRegexp = new RegExp(`([${markdownEscapes.join('')}])`);
const bot = new Telegraf(process.env.TELEGRAM_BOT_API);
// bot.start((ctx) => ctx.reply('Welcome'));
// bot.help((ctx) => ctx.reply('Send me a sticker'));
// bot.on('text', (ctx) => {
//   console.log(ctx);
//   ctx.reply('👍');
// });

const mapUserIdToState = {
  413777946: {
    rss: MY_SETTINGS.rss,
    rssMessageID: null,
    pollOptions: null, // []
    selectedPollOptionsIndex: null, // []
    excludeTags: [...vacancyExcludeTagsMy],
  },
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
    ctx.reply('Invalid RSS url, need starts with "https://career.habr.com/vacancies/rss"', { disable_web_page_preview: true });
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


  ctx.replyWithMarkdown('_Потом вы можете посмотреть список добавленных искл. тегов командой */get_tags*_');

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
      { allows_multiple_answers: true, is_anonymous: false }
    );

    mapUserIdToState[userId].pollOptions[poll.id] = pollOptions;
  }
};

const startMessage = [
  '*Здравствуйте!*',
  '1. Для старта установите RSS ссылку командой */rss*',
  '2. Вы можете указать исключаемые теги командой */ex_tags*',
  '2.1 Вы можете посмотреть список добавленных искл. тегов командой */get_tags*',
  '3 Получить вакансии командой */get* `[from_day_ago=2]`',
  // '4 Подписаться на получение новых вакансий при их появлении командой */sub*'
]

bot.start((ctx) => ctx.replyWithMarkdown(startMessage.join('\n')));
bot.settings(async (ctx) => {
  await ctx.setMyCommands([
    { command: '/rss', description: 'set rss link' },
    { command: '/get', description: 'get last day vacancies' },
    { command: '/ex_tags', description: 'add tags, vacancies with which will be excluded' },
    { command: '/get_tags', description: 'get list your excluded tags' },
    {
      command: '/ex_tags_add',
      description: 'add new tags with save old, vacancies with which will be excluded',
    },
    // {
    //   command: '/ex_words',
    //   description: 'add words, vacancies with which in description will be excluded',
    // },
    // {
    //   command: '/ex_words_add',
    //   description: 'add words, vacancies with which in description will be excluded',
    // },
  ]);
});

bot.help(async (ctx) => {
  const commands = await ctx.getMyCommands();
  const info = commands.reduce((acc, val) => `${acc}/${val.command} - ${val.description}\n`, '');
  return ctx.reply(info);
});

bot.use(async (ctx, next) => {
  const d = Date.now()
  await next(); // runs next middleware
  console.log(`Processing`, Date.now() - d, 'ms');
  console.log('');
});

bot.command('rss', async (ctx) => {
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
});

bot.command('ex_tags', async (ctx) => {
  await setExcludeTags(ctx);
});

bot.command('get_tags', async (ctx) => {
  const userId = ctx.update.message.from.id;
  if (!mapUserIdToState[userId]?.excludeTags) {
    ctx.replyWithMarkdown('Для начала установите RSS ссылку */rss*');
    return;
  }
  if (!mapUserIdToState[userId].excludeTags.length === 0) {
    ctx.replyWithMarkdown('Ваш список исключаемых тегов пуст. Вы можете добавить их командой */ex_tags*');
    return;
  }
  const tagsStr = mapUserIdToState[userId].excludeTags
    // eslint-disable-next-line no-useless-escape
    .map((tag) => `  \`#${tag.replace(markdownRegexp, '\$1')}\``)
    .join('\n');

  ctx.reply(
    `*Ваши исключаемые теги:*\n${tagsStr}\n\nВы можете добавить в список ещё */ex_tags_add* (или задать заново */ex_tags*)`,
    { disable_web_page_preview: true, parse_mode: 'Markdown' }
  );
});

bot.command('ex_tags_add', async (ctx) => {
  await setExcludeTags(ctx, true);
});

bot.command('get', async (ctx) => {
  const userId = ctx.update.message.from.id;
  const rss = mapUserIdToState[userId]?.rss;

  if (!rss) {
    ctx.replyWithMarkdown('RSS not found! Please add that with */rss* [link]');
    console.log('user id', userId, 'not found rss');
    return;
  }
  ctx.telegram.webhookReply = false;

  if (!mapUserIdToState[userId].excludeTags.length === 0) {
    ctx.replyWithMarkdown('_Ваш список исключаемых тегов пуст. Вы можете добавить их командой */ex_tags*_');
  }

  // ctx.telegram.sendPoll
  const dayRaw = ctx.update.message.text.slice(5).trim();
  let day = Number(dayRaw);
  if (!dayRaw) {
    day = 2;
  }
  ctx.reply('Идет обработка вакансий, пожалуйста, подождите несколько секунд...');
  ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');

  try {
    const { stringVacancies } = await getRss(rss, day, mapUserIdToState[userId].excludeTags);
    console.log('вакансии получены', stringVacancies.length);
    const message = stringVacancies.join('\n\n');

    if (Buffer.byteLength(message, 'utf8') >= 4096) {
      for (const messageChunk of _.chunk(stringVacancies, 10)) {
        await ctx.reply(messageChunk.join('\n\n'), {
          disable_web_page_preview: true,
          webhookReply: false,
        });
      }
      ctx.telegram.webhookReply = true;
      return;
    }
    ctx.reply(message, { disable_web_page_preview: true });
  } catch (error) {
    console.log(error);
  }

  const tempMessageId = ctx.message.message_id + 1;
  ctx.deleteMessage(tempMessageId);
});

bot.on('text', async (ctx) => {
  const userId = ctx.update.message.from.id;
  const isRss = mapUserIdToState[userId]?.rssMessageID;

  if (isRss) {
    if (ctx.message.message_id === isRss + 1) {
      await setRss(ctx, ctx.update.message.text);
    } else {
      delete mapUserIdToState[userId].rssMessageID;
    }
  }
});

bot.on('poll_answer', (ctx) => {
  const { poll_answer: poll } = ctx.update;
  if (poll.user.is_bot) {
    return;
  }
  // ctx.update.
  // const userId = poll.user.id;
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
  // setTimeout(() => {
  //   ище.stopPoll(ctx.update.poll_answer.poll_id).then((poll) => console.log(poll));
  // }, 1000);
  // console.log(ctx.update);
});
// bot.inlineQuery();
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
