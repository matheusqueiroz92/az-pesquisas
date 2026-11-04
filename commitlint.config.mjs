// Conventional Commits in English (ADR-001): feat(surveys): publish questionnaire version
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'repo',
        'config',
        'docs',
        'core',
        'contracts',
        'api',
        'web',
        'mobile',
        'identity',
        'surveys',
        'devices',
        'fieldwork',
        'analytics',
        'reporting',
        'infra',
        'ci',
        'deps',
      ],
    ],
    'body-max-line-length': [0],
  },
};
