// Production-grade ESLint flat config for React 19 + TypeScript
// Required packages not yet installed — run:
//   npm install -D eslint-plugin-react eslint-plugin-jsx-a11y eslint-plugin-import
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// TODO: uncomment after installing: npm install -D eslint-plugin-react eslint-plugin-jsx-a11y eslint-plugin-import
// import react from 'eslint-plugin-react'
// import jsxA11y from 'eslint-plugin-jsx-a11y'
// import importPlugin from 'eslint-plugin-import'

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', '*.config.ts', '*.config.js']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // TypeScript strictness
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // React hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // General quality
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'no-implicit-coercion': 'error',

      // TODO: enable after installing eslint-plugin-react
      // 'react/jsx-key': 'error',
      // 'react/no-array-index-key': 'warn',
      // 'react/no-unstable-nested-components': 'error',
      // 'react/self-closing-comp': 'error',
      // 'react/prop-types': 'off',  // TypeScript handles this

      // TODO: enable after installing eslint-plugin-jsx-a11y
      // 'jsx-a11y/alt-text': 'error',
      // 'jsx-a11y/aria-props': 'error',
      // 'jsx-a11y/click-events-have-key-events': 'error',
      // 'jsx-a11y/interactive-supports-focus': 'error',
      // 'jsx-a11y/no-noninteractive-element-interactions': 'warn',

      // TODO: enable after installing eslint-plugin-import
      // 'import/no-unused-modules': 'error',
      // 'import/order': ['error', {
      //   groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      //   'newlines-between': 'always',
      //   alphabetize: { order: 'asc', caseInsensitive: true },
      // }],
      // 'import/no-duplicates': 'error',
    },
  },
])
