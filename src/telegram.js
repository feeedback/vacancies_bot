import 'dotenv/config.js';
import { Telegraf, Markup } from 'telegraf';
import { URL } from 'url';
import _ from 'lodash';
import getRss from './index.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_API);
// bot.start((ctx) => ctx.reply('Welcome'));
// bot.help((ctx) => ctx.reply('Send me a sticker'));
// bot.on('text', (ctx) => {
//   console.log(ctx);
//   ctx.reply('👍');
// });
const MY_URL_RSS =
  'https://career.habr.com/vacancies/rss?currency=RUR&divisions[]=apps&divisions[]=software&divisions[]=backend&divisions[]=frontend&salary=49000&skills[]=264&sort=date&type=all&with_salary=1';

const mapUserIdToState = {
  413777946: {
    rss: MY_URL_RSS,
    rssMessageID: null,
    pollOptions: null,
    selectedPollOptionsIndex: null,
    excludeTags: [],
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
    ctx.reply('invalid RSS url, need starts with "https://career.habr.com/vacancies/rss"');
    return;
  }

  const userId = ctx.update.message.from.id;
  if (!mapUserIdToState[userId]) {
    mapUserIdToState[userId] = {};
  }

  mapUserIdToState[userId].rss = rss;
  await ctx.reply('Saved your RSS successful!');
  console.log('user id', userId, 'rss saved', rss);

  const { topTagsByCount, topTagsByCountByFiltered } = await getRss(rss, 2);
  // await ctx.poll([topTagsByCount]);
  // await ctx.telegram.sendPoll(ctx.chatId: string | number, question: string, options: topTagsByCount, extra ?: ExtraPoll)
  const topTags = Object.entries(topTagsByCount)
    .filter(([, count]) => count >= 2)
    .map(([tag]) => tag);
  const pollOptions = topTags.slice(0, 10);

  mapUserIdToState[userId].pollOptions = pollOptions;
  const poll = await ctx.telegram.sendPoll(
    ctx.chat.id,
    'Выберите теги, вакансии с которыми исключить из выдачи',
    pollOptions,
    { allows_multiple_answers: true, is_anonymous: false }
  );
  console.log(poll);
};

bot.start((ctx) => ctx.replyWithDice());
bot.settings(async (ctx) => {
  await ctx.setMyCommands([
    { command: '/rss', description: 'set rss link' },
    { command: '/get', description: 'get last day vacancies' },
    { command: '/ex_tags', description: 'add tags, vacancies with which will be excluded' },
    {
      command: '/ex_words',
      description: 'add words, vacancies with which in description will be excluded',
    },
  ]);
});

bot.help(async (ctx) => {
  const commands = await ctx.getMyCommands();
  const info = commands.reduce((acc, val) => `${acc}/${val.command} - ${val.description}\n`, '');
  return ctx.reply(info);
});

bot.use(async (ctx, next) => {
  console.time(`Processing`);
  await next(); // runs next middleware
  console.timeEnd(`Processing`);
  console.log('');
});

bot.command('rss', async (ctx) => {
  if (ctx.update.message.text.trim() === '/rss') {
    const message = await ctx.reply(
      'please copy/paste RSS link from Habr.Career with yours filters https://career.habr.com/vacancies',
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

bot.command('get', async (ctx) => {
  const userId = ctx.update.message.from.id;
  const rss = mapUserIdToState[userId]?.rss;

  if (!rss) {
    ctx.reply('RSS not found! Please add that with /rss [link]');
    console.log('user id', userId, 'not found rss');
    return;
  }
  ctx.telegram.webhookReply = false;

  // ctx.telegram.sendPoll
  const dayRaw = ctx.update.message.text.slice(5).trim();
  let day = Number(dayRaw);
  if (!dayRaw) {
    day = 2;
  }
  ctx.reply('Идет обработка вакансий, пожалуйста, подождите несколько секунд...');
  ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');

  try {
    const { stringVacancies } = await getRss(rss, day);
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

  // const userId = poll.user.id;
  const excludeTags = poll.option_ids.map(
    (index) => mapUserIdToState[poll.user.id].pollOptions[index]
  );
  mapUserIdToState[poll.user.id].excludeTags = excludeTags;
  console.log({ excludeTags });
  // setTimeout(() => {
  //   ище.stopPoll(ctx.update.poll_answer.poll_id).then((poll) => console.log(poll));
  // }, 1000);
  // console.log(ctx.update);
});
// bot.inlineQuery();
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
