import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import * as typescriptParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory:    __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig:         js.configs.all,
});

export default [
  { ignores: ['**/*.d.ts', '**/node_modules/**', '**/*.js', '**/*.mjs'] },

  js.configs.recommended,

  importPlugin.flatConfigs.recommended,

  ...compat.extends('plugin:@typescript-eslint/recommended'),

  eslintConfigPrettier,

  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2018,
      sourceType: 'module',
      parserOptions: {
        project:        ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node:       { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      // Naming conventions TS obsoletas
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/camelcase': 'off',

      'import/order': ['error', {
        groups: ['builtin','external','internal','parent','sibling','index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true }
      }],
    },
  },
];
