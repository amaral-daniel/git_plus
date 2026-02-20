// @ts-check
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    { ignores: ['out/**', 'node_modules/**'] },

    // All TypeScript files
    {
        extends: tseslint.configs.recommended,
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },

    // Webview (React) files only
    {
        files: ['src/webview/**/*.{ts,tsx}'],
        plugins: { 'react-hooks': reactHooks },
        rules: reactHooks.configs.recommended.rules,
    },

    // Must be last — disables ESLint rules that would conflict with Prettier
    prettier,
);
