// @-ts-check
import 'dotenv/config.js';
import { Telegraf } from 'telegraf';
import { getHandlers, unsubAll } from './handlers.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_API);
const handlers = getHandlers(bot);

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

bot.command('exwordsset', handlers.command.exwordsset); //
bot.command('exwords', handlers.command.exwords); //
bot.command('exwordsadd', handlers.command.exwordsadd); //

bot.command('sub', handlers.command.sub); //
bot.command('unsub', handlers.command.unsub); //

bot.command('get', handlers.command.get);
// bot.context.reply()
// bot.telegram.sendMessage('1', { parse_mode: 'Markdown' });
// Telegraf.reply()

bot.on('text', handlers.onEvent.textH);
bot.on('poll_answer', handlers.onEvent.poll_answer);
bot.launch();

process.once('SIGINT', () => {
  unsubAll();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  unsubAll();
  bot.stop('SIGTERM');
});
process.on('exit', () => {
  unsubAll();
});
