import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // These are n8n Code-node bodies, not standalone JS modules. n8n supplies
  // the function scope and $-prefixed globals at execution time.
  globalIgnores(['dist', 'n8n/qualification-v3/**']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // This app intentionally resets local UI state in workspace/onboarding
      // lifecycle effects. Keep the hooks dependency rules enabled, but do
      // not treat these synchronous reset effects as lint failures.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
