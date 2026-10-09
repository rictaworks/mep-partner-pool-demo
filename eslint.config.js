import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.wrangler/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'Date', 'fetch', 'crypto', 'console', 'setTimeout', 'setInterval'],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Inject deterministic inputs into the core.' }],
    },
  },
);
