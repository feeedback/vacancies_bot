/* eslint-disable no-bitwise */
import { fileURLToPath } from 'url';
// import qs from 'qs';
import stringSimilarity from 'string-similarity';
// import fs from 'fs';
import path from 'path';
// import crypto from 'crypto';
import dayjs from 'dayjs';

const cyrb53 = (key, seed = 0) => {
  // fastest and simple string hash function (10^9 hashes => zero collision)
  // keys 20 length => 1050 hash/ms, 50 => 750 hash/ms, 500 => 80 hash/ms

  const A = 2654435761;
  const B = 1597334677;
  const C = 2246822507;
  const D = 3266489909;
  const E = 4294967296;
  const F = 2097151;

  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let index = 0, char; index < key.length; index += 1) {
    char = key.charCodeAt(index);

    h1 = Math.imul(h1 ^ char, A);
    h2 = Math.imul(h2 ^ char, B);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), C) ^ Math.imul(h2 ^ (h2 >>> 13), D);
  h2 = Math.imul(h2 ^ (h2 >>> 16), C) ^ Math.imul(h1 ^ (h1 >>> 13), D);

  return E * (F & h2) + (h1 >>> 0);
};
// export const getHashByStr = (str, hashType = 'sha256') =>
//   crypto.createHash(hashType).update(str, 'utf8').digest('hex');

export const getHashByStr = (key) => cyrb53(key);

export const delayMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getDirname = (url) => path.dirname(fileURLToPath(url)); // import.meta.url
export const nowMsDate = () => dayjs().format('HH:mm:ss,SSS DD/MM/YYYY');
export const nowMs = () => dayjs().format('HH:mm:ss,SSS');

export const chunkTextBlocksBySizeByte = (textBlocks, maxSize = 4096) => {
  let size = 0;
  let tailBlocks = textBlocks.length;
  const chunked = [];
  let index = 0;

  while (tailBlocks) {
    chunked[index] = [];

    while (size < maxSize && tailBlocks) {
      const blockText = textBlocks.shift();
      tailBlocks -= 1;

      if (blockText) {
        const blockSize = Buffer.byteLength(blockText, 'utf8');
        if (blockSize > maxSize) {
          throw new Error('One block text size more than maxSize ');
        }

        size += blockSize;

        if (size > maxSize) {
          textBlocks.unshift(blockText);
          tailBlocks += 1;
        } else {
          chunked[index].push(blockText);
        }
      }
    }

    index += 1;
    size = 0;
  }
  return chunked;
};

export const getStringSimilarity = (str1 = '', str2 = '') =>
  stringSimilarity.compareTwoStrings(str1, str2);

// console.log(getHashByStr('a:1').length);
// console.log(getHashByStr('a:1', 'md5').length);
// console.log(crypto.getHashes());
