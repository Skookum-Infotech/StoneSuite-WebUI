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

  // Design system guardrails (DESIGN.md §3 Typography, "Buttons"). Text and
  // color come from the type-* roles and text tokens in styles/typography.css;
  // these rules stop the one-off values the redesign removed from coming back.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/*.test.{ts,tsx}',
      // The app header bar is deliberately kept exactly as it was before the
      // type redesign (product owner's call, Nov 2026) — don't restyle these.
      'src/layouts/MainLayout.tsx',
      'src/components/GlobalSearch.tsx',
      'src/components/HelpMenu.tsx',
      'src/components/NotificationBell.tsx',
    ],
    rules: {
      'no-restricted-syntax': ['error',
        ...['Literal[value=/%s/]', 'TemplateElement[value.raw=/%s/]'].flatMap((sel) => [
          {
            selector: sel.replace('%s', '(^|\\s)(\\S+:)?text-2xs(\\s|$)'),
            message: 'text-2xs (10px) is below the type scale. Use a type-* role or text-micro (11px).',
          },
          {
            selector: sel.replace('%s', '(^|\\s)(\\S+:)?text-\\[[0-9.]+(px|rem)\\]'),
            message: 'One-off font size. Use a type-* role or a size from the type scale (text-micro … text-kpi).',
          },
          {
            selector: sel.replace('%s', '(^|\\s)(\\S+:)?tracking-\\['),
            message: 'One-off letter spacing. Use tracking-tight/wide/wider, a type-* role, or add a token in styles/typography.css.',
          },
          {
            selector: sel.replace('%s', '(^|\\s)(\\S+:)?text-(destructive|red-[567]00|amber-[56]00|brand-dark)(\\/\\d+)?(\\s|$)'),
            message: 'Text color fails contrast or is off-palette. Use text-danger-ink, text-warning-ink, text-success-ink or text-link.',
          },
          {
            selector: sel.replace('%s', '(^|\\s)((?!dark:)[a-z-]+:)?text-stone-[4-9]00(\\/\\d+)?(\\s|$)'),
            message: 'Raw gray text color. Use text-ink-strong (titles, key values), text-ink (body), text-ink-muted (secondary) or text-ink-faint (icons only).',
          },
        ]),
        ...['Property[value.type="Literal"]', 'Property[value.type="TemplateLiteral"][value.expressions.length=0]'].map((prop) => ({
          selector: `JSXAttribute[name.name="style"] ObjectExpression > ${prop}`,
          message: 'Fixed value in an inline style. Use a Tailwind class or a class in styles/*.css; inline styles are only for values computed at runtime.',
        })),
      ],
    },
  },
])
