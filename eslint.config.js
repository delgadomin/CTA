import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/basis/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,js}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-console': ['warn', { allow: ['warn', 'error', 'info'] }] },
  },
);
