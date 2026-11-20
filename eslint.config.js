import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The Google Apps Script bridge runs in Google's V8 runtime with its own globals.
    files: ['src/bridge/appsScript.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: 'script',
      globals: {
        SpreadsheetApp: 'readonly',
        ContentService: 'readonly',
        LockService: 'readonly',
        PropertiesService: 'readonly',
        Utilities: 'readonly',
        Logger: 'readonly',
        console: 'readonly',
      },
    },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^(doGet|doPost|setupToken)$' }] },
  },
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  }
);
