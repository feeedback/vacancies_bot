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

const mapUserIdToRss = {
  413777946: MY_URL_RSS,
};
const mapUserIdToRssMessageID = {};

const setRss = async (ctx, rss) => {
  // console.log(ctx.update.message);
  // console.log(ctx.update.message);
  // const rss = ctx.update.message.text.slice(5).trim();
  // console.log(ctx.update.message);
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

  mapUserIdToRss[ctx.update.message.from.id] = rss;
  await ctx.reply('Saved your RSS successful!');
  console.log('user id', ctx.update.message.from.id, 'rss saved', rss);
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
  // runs after next middleware finishes
  console.timeEnd(`Processing`);
  console.log('');
});

bot.command('rss', async (ctx) => {
  if (ctx.update.message.text.trim() === '/rss') {
    const { message_id: commandMessageId } = await ctx.reply(
      'please copy/paste RSS link from Habr.Career with yours filters https://career.habr.com/vacancies',
      // Markup.inlineKeyboard(['', 'rss_action'])
      // Markup.forceReply(),
      // Markup.keyboard()
      { disable_web_page_preview: true }
    );
    mapUserIdToRssMessageID[ctx.update.message.from.id] = commandMessageId;
    return;
  }

  const rss = ctx.update.message.text.slice(5).trim();
  await setRss(ctx, rss);
});

// bot.action('rss_action', async (ctx) => {

// });

bot.command('get', async (ctx) => {
  const rss = mapUserIdToRss[ctx.update.message.from.id];
  if (!rss) {
    ctx.reply('RSS not found! Please add that with /rss [link]');
    console.log('user id', ctx.update.message.from.id, 'not found rss');
    return;
  }
  ctx.telegram.webhookReply = false;
  const dayRaw = ctx.update.message.text.slice(5).trim();
  let day = Number(dayRaw);
  if (!dayRaw) {
    day = 2;
  }
  ctx.reply('Идет обработка вакансий, пожалуйста, подождите несколько секунд...');
  ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');

  try {
    const stringVacancies = await getRss(rss, day);
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
  // console.log({ ctx });
  const isRss = mapUserIdToRssMessageID[ctx.update.message.from.id];

  if (isRss) {
    if (ctx.message.message_id === isRss + 1) {
      await setRss(ctx, ctx.update.message.text);
    } else {
      delete mapUserIdToRssMessageID[ctx.update.message.from.id];
    }
  }
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
