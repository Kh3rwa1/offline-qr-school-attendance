// @ts-check
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript source files (all) — shared rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      // Declare both Node.js and browser globals so `process`, `Buffer`,
      // `window`, `document` etc. are all recognised without no-undef errors.
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Upgrade TS recommended rules
      ...tsPlugin.configs['recommended'].rules,

      // Disallow the any escape hatches that hide type errors
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // Catch unused variables (except underscore-prefixed)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Prefer const
      'prefer-const': 'error',

      // No floating promises
      '@typescript-eslint/no-floating-promises': 'error',

      // No misused promises (e.g. returning Promise in void context)
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // React / TSX files
  {
    files: ['**/*.tsx'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not required with React 17+ JSX transform
      'react/prop-types': 'off',          // TypeScript handles this
    },
  },

  // Test files — relax some rules
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // Ignore built artifacts and generated files
  {
    ignores: ['dist/**', 'node_modules/**', 'drizzle/**', 'public/**', 'coverage/**'],
  },
];
