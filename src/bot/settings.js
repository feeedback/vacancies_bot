import MY_SETTINGS from '../../data/settings/my_rss.js';
import vacancyExcludeTagsMy from '../../data/settings/exclude_tags.js';
// import vacancyExcludeWordsInDescMy from '../data/exclude_words_desc.js';

export const botStartMessage = [
  '*Здравствуйте!*',
  '1. Для старта *установите RSS* ссылку с фильтром поиска командой */rss*',
  '2. Вы можете *установить* исключаемые *теги* командой */extagsset*',
  '2.1 Вы можете *посмотреть* список добавленных искл. *тегов* командой */extags*',
  '2.2 Вы можете *добавить* в список *новые* исключаемые *теги* командой */extagsadd*',
  '3 *Получить вакансии* командой */get* `[from_day_ago=2]`',
  '4 *Подписаться на* получение *новых вакансий* при их появлении командой */sub*',
  '4.1 *Отписаться на* получение *новых вакансий* при их появлении командой */unsub*',
];

export const commandDescription = [
  { command: '/rss', description: 'Set RSS link with your search filter' },
  { command: '/extagsset', description: 'Add tags, vacancies with which will be excluded' },
  {
    command: '/extagsadd',
    description: 'Add new tags with save old, vacancies with which will be excluded',
  },
  { command: '/extags', description: 'Get list your excluded tags' },
  { command: '/get', description: 'Get new vacancies [from last day]' },
  { command: '/sub', description: 'Subscribe to receive new vacancies' },
  { command: '/unsub', description: 'Unsubscribe to receive new vacancies' },
];

export const initStateUsers = {
  413777946: {
    rss: MY_SETTINGS.rss,
    rssMessageID: null,
    pollOptions: null, // []
    selectedPollOptionsIndex: null, // []
    excludeTags: [...vacancyExcludeTagsMy],
  },
};
