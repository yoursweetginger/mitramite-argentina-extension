/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: '18' },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'complexity': ['error', 10],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    'import/order': ['warn', { 'newlines-between': 'always' }],
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
  env: {
    browser: true,
    es2020: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'vite.config.ts', 'tests/'],
};
