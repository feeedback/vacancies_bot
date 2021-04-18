import 'dotenv/config.js';
import { Telegraf } from 'telegraf';
import handlers from './handlers.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_API);

bot.start(handlers.start);
bot.settings(handlers.settings);
bot.help(handlers.help);

for (const middleware of handlers.use) {
  bot.use(middleware);
}

bot.command('rss', handlers.command.rss);
bot.command('extagsset', handlers.command.extagsset);
bot.command('extags', handlers.command.extags);
bot.command('extagsadd', handlers.command.extagsadd);
bot.command('get', handlers.command.get);
bot.command('sub', handlers.command.sub);
bot.command('unsub', handlers.command.unsub);

bot.on('text', handlers.on.text);
bot.on('poll_answer', handlers.on.poll_answer);

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
