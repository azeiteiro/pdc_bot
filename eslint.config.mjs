import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.cjs'],
  },
  {
    languageOptions: { globals: globals.node },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    rules: {
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': ['error'],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': ['error'],
      '@typescript-eslint/no-unused-vars': 'error',
      'no-unused-vars': 'off',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
    },
  },
];
