module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
    jest: true,
  },
  extends: ['eslint:recommended', 'airbnb-base', 'prettier'],
  plugins: ['jest', 'prettier'],
  globals: {},
  parserOptions: {
    ecmaVersion: 11,
    sourceType: 'module',
    requireConfigFile: false,
  },
  parser: '@babel/eslint-parser',
  rules: {
    'import/extensions': 0,
    'no-underscore-dangle': [2, { allow: ['__filename', '__dirname'] }],
    'no-restricted-syntax': ['off', 'ForOfStatement'],
    'no-await-in-loop': 'off',
    'dot-notation': ['off'],
    'no-console': 'off',
    'prettier/prettier': ['error', { endOfLine: 'auto', printWidth: 100 }],
  },
};
