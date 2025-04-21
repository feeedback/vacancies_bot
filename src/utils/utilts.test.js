import {
  chunkTextBlocksBySizeByte,
  getHashByStr,
  getStringSimilarity,
  nowMs,
  nowMsDate,
} from './utils.js';

describe('cyrb53 hash function (via getHashByStr)', () => {
  test('should generate consistent hash for the same input', () => {
    const input = 'test string';
    expect(getHashByStr(input)).toBe(getHashByStr(input));
    expect(typeof getHashByStr(input)).toBe('number');
  });

  test('should generate different hashes for different inputs', () => {
    expect(getHashByStr('hello')).not.toBe(getHashByStr('world'));
    expect(getHashByStr('a')).not.toBe(getHashByStr('b'));
  });

  test('should handle edge cases properly', () => {
    // Empty string
    expect(getHashByStr('')).toBeDefined();

    // Long string
    const longString = 'a'.repeat(10000);
    expect(getHashByStr(longString)).toBeDefined();

    // Special characters
    expect(getHashByStr('!@#$%^&*()')).toBeDefined();
    expect(getHashByStr('😀🚀💻')).toBeDefined();
  });

  test('should generate deterministic hashes regardless of execution time', () => {
    const inputs = ['test1', 'another test', 'javascript', '1234567890'];

    // Store initial hash values
    const initialHashes = inputs.map((input) => getHashByStr(input));

    // Compare with new hash values
    inputs.forEach((input, index) => {
      expect(getHashByStr(input)).toBe(initialHashes[index]);
    });
  });
});

describe('nowMsDate and nowMs', () => {
  test('should return formatted date/time strings', () => {
    expect(typeof nowMsDate()).toBe('string');
    expect(typeof nowMs()).toBe('string');
    expect(nowMsDate()).toMatch(/\d{2}:\d{2}:\d{2},\d{3} \d{2}\/\d{2}\/\d{4}/);
    expect(nowMs()).toMatch(/\d{2}:\d{2}:\d{2},\d{3}/);
  });
});

describe('chunkTextBlocksBySizeByte', () => {
  test('should chunk text blocks by max byte size', () => {
    const blocks = ['a'.repeat(10), 'b'.repeat(20), 'c'.repeat(30)];
    const maxSize = 30;
    const result = chunkTextBlocksBySizeByte(blocks, maxSize);

    expect(result.length).toBeGreaterThan(1);
    expect(result.flat().join('')).toBe(blocks.join(''));

    result.forEach((chunk) => {
      const size = Buffer.byteLength(chunk.join(''), 'utf8');
      expect(size).toBeLessThanOrEqual(maxSize * chunk.length);
    });
  });

  test('should throw if a single block is too large', () => {
    const blocks = ['a'.repeat(100)];
    expect(() => chunkTextBlocksBySizeByte(blocks, 10)).toThrow();
  });

  test('should handle empty input', () => {
    expect(chunkTextBlocksBySizeByte([], 100)).toEqual([]);
  });
});

describe('getStringSimilarity', () => {
  test('should return 1 for identical strings', () => {
    expect(getStringSimilarity('abc', 'abc')).toBe(1);
  });
  test('should return 0 for completely different strings', () => {
    expect(getStringSimilarity('abc', 'xyz')).toBe(0);
  });
  test('should return a value between 0 and 1 for similar strings', () => {
    const sim = getStringSimilarity('abc', 'ab');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
    expect(sim).toBeCloseTo(0.666, 2); // Adjust precision as needed
  });
});
