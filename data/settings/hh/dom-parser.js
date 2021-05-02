import jsdom from 'jsdom';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js';
import dayjsRelativeTime from 'dayjs/plugin/relativeTime.js';
import dayjsUtc from 'dayjs/plugin/utc.js';
import { getHashByStr } from '../../../src/utils/utils.js';

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsRelativeTime);
dayjs.extend(dayjsUtc);
const getDOMDocument = (data) => new jsdom.JSDOM(data).window.document;

const BASE_VACANCY_LINK = 'https://hh.ru/vacancy';
const REGEX_SALARY = /(?:(?:^(?:от)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:до)\s*(?:(\d[\s\d]*\d)+))|(?:^(?:(\d[\s\d]*\d)+)-(?:(\d[\s\d]*\d)+)))(?: (.+)$)/i;
const mapCurrencyStrToCode = {
  'USD': 'USD',
  'руб.': 'RUB',
};

export default (data) => {
  const document = getDOMDocument(data);
  const vacanciesEl = [...document.querySelectorAll('.vacancy-serp-item')];
  console.log('vacancies count:', vacanciesEl.length);
  const getChildTextByDataAttr = (el, str, addStr = '', isText = true) => {
    const child = el.querySelector(`[data-qa="${str}"]${addStr ? `${` ${addStr}`}` : ''}`);
    return isText ? child?.textContent?.trim() : child;
  };

  const vacanciesData = vacanciesEl.map((vacancy, i) => {
    console.log('vacancy', '№:', i);
    const getElByAttr = (attr, ...restArgs) => getChildTextByDataAttr(vacancy, attr, ...restArgs);

    const tasks = getElByAttr('vacancy-serp__vacancy_snippet_responsibility');
    const skills = getElByAttr('vacancy-serp__vacancy_snippet_requirement');
    const title = getElByAttr('vacancy-serp__vacancy-title');

    const id = getElByAttr('vacancy-serp__vacancy-title', '', false)
      .href.split('?')[0]
      .split('vacancy/')[1];
    const link = `${BASE_VACANCY_LINK}/${id}`;

    const salaryStr = getElByAttr('vacancy-serp__vacancy-compensation');
    let salary = null;
    if (salaryStr) {
      const [, rawMin, rawMax, rawFrom, rawTo, rawCurrencySymbol] = salaryStr.match(REGEX_SALARY);

      salary = {
        rawMin,
        rawMax,
        rawFrom,
        rawTo,
        rawCurrencySymbol: mapCurrencyStrToCode[rawCurrencySymbol],
      };
    }

    const company = getElByAttr('vacancy-serp__vacancy-employer');
    const address = getElByAttr('vacancy-serp__vacancy-address');
    const city = address.split(',')[0];

    const dateMonthDay = getElByAttr(
      'vacancy-serp__vacancy-date',
      '.vacancy-serp-item__publication-date_short'
    );
    const createdAt = dayjs.utc(dateMonthDay, 'DD-MM').unix();
    const ago = dayjs().to(dayjs.unix(createdAt));
    const content = [title, company, salaryStr, tasks, skills].join('\n');

    return {
      id,
      title,
      tasks,
      skills,
      link,
      salary,
      company,
      // address,
      city,
      createdAt,
      ago,
      // content,
      hashContent: getHashByStr(content),
    };
  });

  console.log(vacanciesData);
};
