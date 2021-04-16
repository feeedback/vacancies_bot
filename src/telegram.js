import 'dotenv/config.js';
import { Telegraf } from 'telegraf';
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
const mapUserIdToRss = {};
bot.command('rss', (ctx) => {
  const rss = ctx.update.message.text.slice(5).trim();
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
  ctx.reply('Saved your RSS successful!');
  console.log('user id', ctx.update.message.from.id, 'rss saved', rss);
});

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
});
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
