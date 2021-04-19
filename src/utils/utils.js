import { fileURLToPath } from 'url';
// import qs from 'qs';
// import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dayjs from 'dayjs';

export const getHashByStr = (str) => crypto.createHash('sha256').update(str, 'utf8').digest('hex');

export const delayMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getDirname = (url) => path.dirname(fileURLToPath(url)); // import.meta.url
export const nowMsDate = () => dayjs().format('HH:mm:ss,SSS DD/MM/YYYY');
export const nowMs = () => dayjs().format('HH:mm:ss,SSS');
