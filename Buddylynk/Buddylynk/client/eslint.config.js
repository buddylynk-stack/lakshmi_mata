import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Disable all common warnings
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-undef': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
      'no-constant-condition': 'off',
      'no-extra-boolean-cast': 'off',
      'no-case-declarations': 'off',
      // React hooks
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'off',
      // Disable react-refresh
      'react-refresh/only-export-components': 'off',
    },
  },
])
