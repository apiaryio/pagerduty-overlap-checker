const { assert } = require('chai');
const config = require('../src/config');
const nconf = require('nconf');

describe('Get config for PagerDuty Overrides', () => {
  it('NODE_ENV isn\'t set', () => assert.equal(nconf.get('NODE_ENV'), undefined));

  return it('PAGERDUTY_READ_ONLY_TOKEN isn\'t set', () => assert.equal(nconf.get('PAGERDUTY_READ_ONLY_TOKEN'), undefined));
});

describe('Setup config and get config', () => {
  before(done =>
    config.setupConfig(`${__dirname}/fixtures/config.json`, err => done(err))
  );

  it('NODE_ENV isn\'t set', () => assert.equal(nconf.get('NODE_ENV'), undefined));

  return it('PAGERDUTY_READ_ONLY_TOKEN is set', () => assert.equal(nconf.get('PAGERDUTY_READ_ONLY_TOKEN'), 'dummy'));
});
