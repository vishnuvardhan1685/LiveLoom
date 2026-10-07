module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react'],
  rules: {
    // Prevent native browser dialog APIs — use <ConfirmDialog> / <InputDialog> / <Toast> instead.
    'no-alert': 'error',

    // Allow unused vars starting with _ (common convention for intentionally unused params)
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
}
