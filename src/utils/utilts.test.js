import { getHashByStr } from './utils.js';

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
