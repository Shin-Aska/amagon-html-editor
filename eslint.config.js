import eslint from '@eslint/js'
import {defineConfig, globalIgnores} from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
    globalIgnores([
        'dist/**',
        'node_modules/**',
        'out/**',
        'public/**',
        'release/**',
        'src/renderer/data/*.json'
    ]),
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        plugins: {
            'react-hooks': reactHooks
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
            '@typescript-eslint/no-unsafe-function-type': 'off',
            'no-control-regex': 'off',
            'no-empty': ['error', {allowEmptyCatch: true}],
            'no-useless-assignment': 'warn',
            'no-useless-escape': 'off',
            'prefer-const': 'off',
            'react-hooks/exhaustive-deps': 'warn',
            'react-hooks/rules-of-hooks': 'error'
        }
    },
    {
        files: ['src/main/**/*.{ts,tsx}', 'src/preload/**/*.{ts,tsx}', '*.config.{js,ts}', 'scripts/**/*.{js,mjs,ts}'],
        languageOptions: {
            globals: globals.node
        }
    }
)
