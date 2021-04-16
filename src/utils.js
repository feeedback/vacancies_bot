import { fileURLToPath } from 'url';
// import qs from 'qs';
// import fs from 'fs';
import path from 'path';

export const delayMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const __dirname = path.dirname(fileURLToPath(import.meta.url));
