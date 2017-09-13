/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert }   = require('chai');
const nock     = require('nock');
const nconf    = require('nconf');
const debug    = require('debug')('pagerduty-overrides:tests');

const config   = require('../src/config');
const pd       = require('../src/pagerduty');

const configPath = __dirname + '/fixtures/config.json';
const configWithDaysPath = __dirname + '/fixtures/config-days.json';
const configWrongPath = __dirname + '/fixtures/config-wrong.json';

nock.disableNetConnect();

describe('Get schedules Ids', function() {
  let schedules = null;

  before(done =>
    config.setupConfig(configPath, function(err) {
      if (err) { return done(err); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/schedules.json');

      return pd.getSchedulesIds(function(err, schedulesIds) {
        schedules = schedulesIds;
        return done(err);
      });
    })
  );

  return it('Check how many schedules', () => assert.equal(schedules.length, 2));
});

describe('Check schedules', function() {
  let schedules = null;

  before(done =>
    config.setupConfig(configPath, function(err) {
      if (err) { return done(err); }

      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/schedules.json');

      return pd.checkSchedulesIds(function(err, res) {
        schedules = res;
        return done(err);
      });
    })
  );

  return it('Check if config ids are in pagerduty schedules', () => assert.ok(schedules));
});

describe('Check schedules with wrong config', function() {
  let schedules = null;

  before(done =>
    config.setupConfig(configWrongPath, function(err) {
      if (err) { return done(err); }

      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/schedules.json');

      return pd.checkSchedulesIds(function(err, res) {
        schedules = res;
        return done(err);
      });
    })
  );

  return it('Check if config ids are in pagerduty schedules', () => assert.notOk(schedules));
});

describe('Compare schedules', function() {

  let message = null;

  before(done =>
    config.setupConfig(configPath, function(err) {
      if (err) { return done(err); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/schedules.json');

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/entries.json');

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/entries.json');

      nock('https://api.pagerduty.com/')
        .post('/incidents', require('./fixtures/incident.json'))
        .query(true)
        .reply(200, 'ok');

      nock('https://api.pagerduty.com/')
        .post('/incidents', require('./fixtures/incident2.json'))
        .query(true)
        .reply(200, 'ok');

      nock('https://incomingUrl/').post("/").reply(200, 'ok');

      return pd.checkSchedulesIds(function(err, res) {
        if (err) { return done(err); }
        if (!res) {
          return done(new Error("Check failed"));
        }
        return pd.processSchedulesFromConfig(function(err, msg) {
          if (err) { return done(err); }
          message = msg;
          return done(err);
        });
      });
    })
  );

  it('Check if there are 2 returned messages', function() {
    assert.isArray(message);
    return assert.lengthOf(message, 2);
  });

  return it('Check returned messages if they contain "Primary and Secondary"', () =>
    (() => {
      const result = [];
      for (let singleMessage of Array.from(message)) {
        debug(singleMessage);
        assert.isObject(singleMessage);
        assert.include(singleMessage.schedules, "Primary");
        result.push(assert.include(singleMessage.schedules, "Secondary"));
      }
      return result;
    })()
  );
});


describe('Compare schedules on specific days', function() {

  let message = null;

  before(done =>
    config.setupConfig(configWithDaysPath, function(err) {
      if (err) { return done(err); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/schedules.json');

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/entries-days.json');

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/entries-days.json');

      nock('https://api.pagerduty.com/')
        .post('/incidents', require('./fixtures/incident.json'))
        .query(true)
        .reply(200, 'ok');

      nock('https://incomingUrl/').post("/").reply(200, 'ok');

      return pd.checkSchedulesIds(function(err, res) {
        if (err) { return done(err); }
        if (!res) {
          return done(new Error("Check failed"));
        }
        return pd.processSchedulesFromConfig(function(err, msg) {
          if (err) { return done(err); }
          message = msg;
          return done(err);
        });
      });
    })
  );

  it('Check if there is 1 returned message', function() {
    assert.isArray(message);
    return assert.lengthOf(message, 1);
  });

  return it('Check if the returned message contains "Primary and Secondary"', () =>
    (() => {
      const result = [];
      for (let singleMessage of Array.from(message)) {
        debug(singleMessage);
        assert.isObject(singleMessage);
        assert.include(singleMessage.schedules, "Primary");
        result.push(assert.include(singleMessage.schedules, "Secondary"));
      }
      return result;
    })()
  );
});

describe('Compare schedules with no overlap', function() {

  let message = null;

  before(done =>
    config.setupConfig(configPath, function(err) {
      if (err) { return done(err); }
      nock('https://api.pagerduty.com/')
      .get('/schedules')
      .query(true)
      .replyWithFile(200, __dirname + '/fixtures/schedules.json');

      nock('https://api.pagerduty.com/')
      .get('/oncalls')
      .query(true)
      .replyWithFile(200, __dirname + '/fixtures/entries.json');

      nock('https://api.pagerduty.com/')
      .get('/oncalls')
      .query(true)
      .replyWithFile(200, __dirname + '/fixtures/entries-no-overlap.json');

      return pd.checkSchedulesIds(function(err, res) {
        if (err) { return done(err); }
        if (!res) {
          return done(new Error("Check failed"));
        }
        return pd.processSchedulesFromConfig(function(err, msg) {
          if (err) { return done(err); }
          message = msg;
          return done(err);
        });
      });
    })
  );

  return it('Check that there are no returned messages', function() {
    assert.isArray(message);
    return assert.isEmpty(message);
  });
});
