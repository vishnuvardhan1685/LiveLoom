import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        EventSource: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        Promise: 'readonly',
      },
    },
    rules: {
      // Prevent native browser dialog APIs.
      // Use <ConfirmDialog>, <InputDialog>, or toast() instead.
      'no-alert': 'error',

      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
