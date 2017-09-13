/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert }   = require('chai');
const config   = require('../src/config');
const nconf    = require('nconf');
const debug    = require('debug')('pagerduty-overrides:tests');

describe('Get config for PagerDuty Overrides', function() {

  it('NODE_ENV isn\'t set', () => assert.equal(nconf.get('NODE_ENV'), undefined));

  return it('PAGERDUTY_READ_ONLY_TOKEN isn\'t set', () => assert.equal(nconf.get('PAGERDUTY_READ_ONLY_TOKEN'), undefined));
});

describe('Setup config and get config', function() {

  before(done =>
    config.setupConfig(__dirname + '/fixtures/config.json', err => done(err))
  );

  it('NODE_ENV isn\'t set', () => assert.equal(nconf.get('NODE_ENV'), undefined));

  return it('PAGERDUTY_READ_ONLY_TOKEN is set', () => assert.equal(nconf.get('PAGERDUTY_READ_ONLY_TOKEN'), 'E7px6VVr3PVHZPJq51oa'));
});
