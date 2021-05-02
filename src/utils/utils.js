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
