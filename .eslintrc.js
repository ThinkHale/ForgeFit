module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    es2021: true,
    node: true,
  },
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['node_modules/', 'ios/', 'supabase/functions/'],
};
