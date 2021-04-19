## Хабр.Карьера удобная фильтрация/уведомления

**Telegram бот для получения вакансий по своему гибкому фильтру с career.habr.com**

[![wakatime](https://wakatime.com/badge/github/feeedback/habr_career_bot.svg)](https://wakatime.com/badge/github/feeedback/habr_career_bot)
[![eslint CI](https://github.com/feeedback/habr_career_bot/actions/workflows/nodejs.yml/badge.svg)](https://github.com/feeedback/habr_career_bot/actions/workflows/nodejs.yml)

### Roadmap telegram bot

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

- [x] Кэширования результата запроса RSS вакансий: время кэша зависит от новизны вакансии (1-ая страница на 3 минуты, 2 — 6,3 — 9, старые вакансии на 5 часов)
- [x] Кэширования результата запроса курсов валют (на 12 часов)
- [x] Возвращения хэша вакансий, для функционала исключения старых
- [x] Фоллбек при ошибке запроса курса валют на usd/rub 1/75
- [x] Фильтрация вакансий по словам в описании вакансии (исключающая вакансии, которые они имеют)
- [x] Фильтрация вакансий по тегам (исключающая вакансии, которые они имеют)
- [x] Фильтрация вакансий по min/max зп
- [x] Форматирование вакансии стандартным образом (кратко, единый формат отображения предложения ЗП)
- [x] Парсинг предлагаемой ЗП в удобной валюте/формате
- [x] Парсинг вакансий через RSS (с родным фильтром поиска в ссылке)
