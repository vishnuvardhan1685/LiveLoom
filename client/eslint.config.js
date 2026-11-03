import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // Required for ESLint's built-in JS parser to handle JSX syntax in .jsx files.
      // Without this, every JSX file fails with "Parsing error: Unexpected token <".
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        // Browser runtime globals
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        EventSource: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Buffer: 'readonly',
        Promise: 'readonly',
        navigator: 'readonly',
        // File & binary APIs used in useFileUpload.js and other hooks
        FileReader: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        // JS built-ins accessed directly (not via globalThis) in server-side utils
        Map: 'readonly',
        Set: 'readonly',
        WeakSet: 'readonly',
        Symbol: 'readonly',
        Uint8Array: 'readonly',
        Float64Array: 'readonly',
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
