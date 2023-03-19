export const requestConfig = {
  // BASE_VACANCY_LINK: 'https://hh.ru/vacancy',
  BASE_URL: 'https://hh.ru/search/vacancy',
  BASE_URL_JSON: 'https://hh.ru/shards/vacancy/search',
  headers: {
    'accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
    'sec-ch-ua-mobile': '?0',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
  },
  headersJson: {
    'accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'ru-RU,ru;q=0.9',
    'sec-ch-ua': '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36', // выдаёт online счетчик юзеров только с useragent
  },
};
export const syntaxSearch = {
  AND: (...wordsArr) => wordsArr.join(' AND '),
  OR: (...wordsArr) => wordsArr.join(' OR '),
  EXCLUDE: (wordsStr) => `NOT (${wordsStr})`,
  INCLUDE: (wordsStr) => `(${wordsStr})`,
  BY_TITLE: (wordsStr) => `NAME:(${wordsStr})`,
  BY_DESC: (wordsStr) => `DESCRIPTION:(${wordsStr})`,
  BY_ALL: (wordsStr) => `(${wordsStr})`,
  ALL: (...str) => str.join(' '),
};
export const filterVacanciesSearchBase = {
  L_is_autosearch: true,
  // date_from: '30.04.2021 10:51:11',
  // date_from: dayjs().subtract('5', 'minute').format('DD.MM.YYYY HH:mm:ss'), // last request time
  order_by: 'publication_time',
  no_magic: true, // ???
  // items_on_page: 100,
  items_on_page: 20,
  enable_snippets: true,
  // only_with_salary: true,
};
