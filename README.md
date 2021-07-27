## Telegram бот для получения вакансий по своему гибкому фильтр

_в разработке..._ [![wakatime](https://wakatime.com/badge/github/feeedback/vacancies_bot.svg)](https://wakatime.com/badge/github/feeedback/vacancies_bot) [![eslint](https://github.com/feeedback/vacancies_bot/actions/workflows/nodejs.yml/badge.svg)](https://github.com/feeedback/vacancies_bot/actions/workflows/nodejs.yml)

### Roadmap telegram bot

- [ ] Деплой на облаке. AWS? Azure? Google Cloud?
- [x] Команда `/exwords` - посмотреть ваши настроенные исключаемые слова
- [x] Команда `/exwords_add` - добавления новых исключаемых слов с сохранением старых
- [x] Команда `/exwords_set` - добавления слов из описания, вакансии с которыми уберутся из выдачи
- [x] Команда `/unsub` - отписаться от получения новых вакансий
- [x] Команда `/sub` - подписаться на получение новых вакансий согласно фильтру при их появлении
- [x] Команда `/get [from_day_ago=2]` - получение вакансий согласно фильтру
- [x] Команда `/extags` - посмотреть ваши настроенные исключаемые теги
- [x] Команда `/extagsadd` - добавление новых исключаемых тегов с сохранением старых
- [x] Команда `/extagsset` - добавление тегов, вакансии с которыми уберутся из выдачи
- [x] Команда `/rss [link]` - Установка в бот своей ссылки RSS с фильтрами из career.habr.com

### Roadmap career.habr API

- [x] Формирование списка ключевых слов и тегов из вакансий, на выбор для исключения
- [x] Кэширования результата запроса RSS вакансий: время кэша зависит от новизны вакансии
- [x] Фильтрация вакансий по словам в описании вакансии (исключающая вакансии, которые они имеют)
- [x] Фильтрация вакансий по тегам (исключающая вакансии, которые они имеют)
- [x] Парсинг вакансий через RSS (с родным фильтром поиска в ссылке)

### Roadmap HeadHunter API

- [ ] Работа через официальный API
- [ ] Поддержка управлением включаемых и исключаемых слов через бота
- [ ] Формирование списка ключевых слов из вакансий, на выбор для исключения
- [ ] Указание времени редактирования вакансии при редактировании, чтобы не создавалось впечатление что показывают старую вакансию (сохранять id)
- [ ] Вынести hash вакансии отдельно в базе данных, отдельно у пользователей, чтобы не было дублирования
- [x] Подписка на вакансии
- [x] Запрос вакансий по фильтру - фильтр из меню, исключаемые и включаемые слова - везде, в названии, в описании (тегов нет)
- [x] Парсинг вакансий

### Roadmap common

- [ ] Поддержка выбора города(ов) (сейчас ищет HH удалёнку, а Habr.career все города)
- [ ] Поддержка разных источников вакансий, рефакторинг команд бота (сейчас HH работает только get/sub/unsub - совмещает вакансии с разных источников)
- [ ] Объединение похожих вакансий (0.8 по близости тексту (Коэффициент Сёренсена)). Каким образом отображать?
- [x] Вывод требуемого грейда в вакансии (Intern, Junior, Junior-Middle, Middle, Middle++)
- [x] Объединение одинаковых вакансий (100% совпадение текста, исключая местоположение)
- [x] Возвращения хэша вакансий, для функционала исключения старых
- [x] Форматирование вакансии стандартным образом (кратко, единый формат отображения предложения ЗП)
- [x] Парсинг предлагаемой ЗП в удобной валюте/формате
- [x] Кэширования результата запроса курсов валют (на 12 часов)
- [x] Фоллбек при ошибке запроса курса валют на usd/rub 1/75
- [x] Фильтрация вакансий по min/max ЗП (min указывается в запросе чтоб уменьшить количество запросов, а max фильтруется на месте)
