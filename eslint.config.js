import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const req = (function () {
  const candidates = [
    process.cwd() + '/package.json',
    process.cwd() + '/accordillon/package.json',
    process.cwd() + '/batch-emailing/package.json',
    process.cwd() + '/timeline/package.json',
    process.cwd() + '/timeline_v2/package.json'
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      try {
        const r = createRequire(c);
        r.resolve('@eslint/js');
        return r;
      } catch {}
    }
  }
  return createRequire(import.meta.url);
})();

const js = req('@eslint/js');
const globals = req('globals');

let tsParser = null;
try {
  tsParser = req('@typescript-eslint/parser');
} catch {}

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        grist: 'readonly',
        __APP_VERSION__: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off'
    }
  },
  ...(tsParser
    ? [
        {
          files: ['**/*.ts'],
          languageOptions: {
            parser: tsParser,
            parserOptions: {
              ecmaVersion: 'latest',
              sourceType: 'module'
            },
            globals: {
              ...globals.browser,
              grist: 'readonly',
              __APP_VERSION__: 'readonly'
            }
          },
          rules: {
            'no-unused-vars': [
              'warn',
              {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
              }
            ],
            'no-undef': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-console': 'off'
          }
        }
      ]
    : []),
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'DSFR/**',
      'FR/**',
      'WIP/**',
      'url-renderer/**'
    ]
  }
];
