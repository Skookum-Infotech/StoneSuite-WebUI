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
      // Dark-themed drawing-editor surfaces (toolbars, rails, slab panels) keep
      // their own dark palette; the type roles and inks are for light pages.
      'src/components/drawing/AreaSidebar.tsx',
      'src/components/drawing/AreaSummary.tsx',
      'src/components/drawing/AttachedProfileTypePicker.tsx',
      'src/components/drawing/BorderExisting.tsx',
      'src/components/drawing/CornerExisting.tsx',
      'src/components/drawing/DrawModeBar.tsx',
      'src/components/drawing/DrawingStatusBar.tsx',
      'src/components/drawing/DrawingToolbar.tsx',
      'src/components/drawing/DxfFilePanel.tsx',
      'src/components/drawing/EdgeModeBar.tsx',
      'src/components/drawing/EdgeTypePicker.tsx',
      'src/components/drawing/MeasurementsForm.tsx',
      'src/components/drawing/ProfileModeBar.tsx',
      'src/components/drawing/SlabCard.tsx',
      'src/components/drawing/SlabOptionsTable.tsx',
      'src/components/drawing/TextControls.tsx',
      'src/components/drawing/ToolFlyout.tsx',
      'src/components/drawing/ToolModeBar.tsx',
      'src/components/drawing/ViewModeToggle.tsx',
      'src/components/drawing/WorkspaceTabs.tsx',
      'src/components/drawing/railStyles.ts',
      'src/components/drawing/three/HandToggle.tsx',
      'src/components/drawing/three/ViewPresetBar.tsx',
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
