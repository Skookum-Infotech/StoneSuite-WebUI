// Production-grade ESLint flat config for React 19 + TypeScript.
// eslint-plugin-react / -jsx-a11y / -import only declare peer support up to
// ESLint 9, so this repo (ESLint 10) uses their maintained successors instead:
// @eslint-react, eslint-plugin-jsx-a11y-x and eslint-plugin-import-x.
import js from '@eslint/js'
import globals from 'globals'
import eslintReact from '@eslint-react/eslint-plugin'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import importPlugin from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', '.claude/**', '.superpowers/**', '*.config.ts', '*.config.js']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      '@eslint-react': eslintReact,
      'jsx-a11y-x': jsxA11y,
      'import-x': importPlugin,
    },
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

      // React (@eslint-react; prop-types is off because TypeScript covers it)
      '@eslint-react/no-missing-key': 'error',
      '@eslint-react/no-array-index-key': 'warn',
      '@eslint-react/no-nested-component-definitions': 'error',

      // Accessibility (jsx-a11y-x)
      'jsx-a11y-x/alt-text': 'error',
      'jsx-a11y-x/aria-props': 'error',
      // 'warn', not 'error': ~90 modal backdrops close on a mouse click while
      // keyboard users dismiss with Escape (useModalDialog). Splitting the
      // backdrop from the dialog element is the ModalShell refactor; once that
      // lands this goes back to 'error'.
      'jsx-a11y-x/click-events-have-key-events': 'warn',
      'jsx-a11y-x/interactive-supports-focus': 'error',
      'jsx-a11y-x/no-noninteractive-element-interactions': 'warn',

      // Imports (import-x)
      'import-x/no-duplicates': 'error',
    },
  },
])
