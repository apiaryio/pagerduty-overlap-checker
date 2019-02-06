module.exports = {
  'extends': 'airbnb-base',
  'env': {
    'node': true,
    'mocha': true,
  },
  'rules': {
    'no-console': 0,
    'import/no-amd': 0,
    'import/no-extraneous-dependencies': 0,
    'comma-dangle': ['error', {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'never', // This is not supported in Node without Babel transform
    }],
    'import/no-unresolved': [
      2,
      { caseSensitive: false }
    ],
    'prefer-destructuring': 'off',
  }
};
