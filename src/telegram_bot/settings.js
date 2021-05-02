import MY_SETTINGS from '../../data/settings/my_rss.js';
import vacancyExcludeTagsMy from '../../data/settings/exclude_tags.js';
import vacancyExcludeWordsInDescMy from '../../data/settings/exclude_words_title.js';
import * as HHmyFiltersWords from '../../data/settings/hh/hh_words.js';
import HHmyFilter from '../../data/settings/hh/my_filter.js';

export const botStartMessage = [
  '*Здравствуйте!* Бот позволяет гибко фильтровать и подписываться на новые вакансии!\n',
  '1. Для старта *установите RSS* ссылку с фильтром поиска командой */rss*',

  '2. *Установить* исключаемые *теги* командой */extagsset*',
  '    2.1 *Посмотреть* список добавленных искл. *тегов* командой */extags*',
  '    2.2 *Добавить* в список *новые* исключаемые *теги* командой */extagsadd*',

  '3. *Установить* исключаемые *слова* командой */exwordsset*',
  '    3.1 *Посмотреть* список добавленных искл. *слов* командой */exwords*',
  '    3.2 *Добавить* в список *новые* исключаемые *слова* командой */exwordsadd*',

  '4 *Получить вакансии* командой */get* `[from_day_ago=2]`',
  '5 *Подписаться на* получение *новых вакансий* при их появлении командой */sub*',
  '    5.1 *Отписаться на* получение *новых вакансий* при их появлении командой */unsub*',
];

export const commandDescription = [
  { command: '/rss', description: 'Set RSS link with your search filter' },
  { command: '/extags', description: 'Get list your excluded tags' },
  { command: '/exwords', description: 'Get list your excluded words' },
  { command: '/get', description: 'Get new vacancies [from last day]' },
  { command: '/sub', description: 'Subscribe to receive new vacancies' },
  { command: '/unsub', description: 'Unsubscribe to receive new vacancies' },
  { command: '/extagsset', description: 'Add tags, vacancies with which will be excluded' },
  {
    command: '/extagsadd',
    description: 'Add new tags with save old, vacancies with which will be excluded',
  },
  { command: '/exwordsset', description: 'Add words, vacancies with which will be excluded' },
  {
    command: '/exwordsadd',
    description: 'Add new words with save old, vacancies with which will be excluded',
  },
];

export const initStateUsers = {
  413777946: {
    rss: MY_SETTINGS.rss,
    rssMessageID: null,
    // pollOptionsExTags: null, // []
    // selectedPollOptionsIndex: null, // []
    excludeTags: [...vacancyExcludeTagsMy],
    excludeWords: [...vacancyExcludeWordsInDescMy],
    HH: { filter: HHmyFilter, words: HHmyFiltersWords },
  },
};
