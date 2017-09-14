const { assert } = require('chai');
const nock = require('nock');
const debug = require('debug')('pagerduty-overrides:tests');

const config = require('../src/config');
const pd = require('../src/pagerduty');

const configPath = `${__dirname}/fixtures/config.json`;
const configWithDaysPath = `${__dirname}/fixtures/config-days.json`;
const configWrongPath = `${__dirname}/fixtures/config-wrong.json`;

const incident = require('./fixtures/incident.json');
const incident2 = require('./fixtures/incident2.json');

nock.disableNetConnect();

describe('Get schedules Ids', () => {
  let schedules = null;

  before(done =>
    config.setupConfig(configPath, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      return pd.getSchedulesIds((err, schedulesIds) => {
        schedules = schedulesIds;
        return done(err);
      });
    })
  );

  return it('Check how many schedules', () => assert.equal(schedules.length, 2));
});

describe('Check schedules', () => {
  let schedules = null;

  before(done =>
    config.setupConfig(configPath, (configErr) => {
      if (configErr) { return done(configErr); }

      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      return pd.checkSchedulesIds((err, res) => {
        schedules = res;
        return done(err);
      });
    })
  );

  return it('Check if config ids are in pagerduty schedules', () => assert.ok(schedules));
});

describe('Check schedules with wrong config', () => {
  let schedules = null;

  before(done =>
    config.setupConfig(configWrongPath, (configErr) => {
      if (configErr) { return done(configErr); }

      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      return pd.checkSchedulesIds((err, res) => {
        schedules = res;
        return done(err);
      });
    })
  );

  return it('Check if config ids are in pagerduty schedules', () => assert.notOk(schedules));
});

describe('Compare schedules', () => {
  let message = null;

  before(done =>
    config.setupConfig(configPath, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries.json`);

      nock('https://api.pagerduty.com/')
        .post('/incidents', incident)
        .query(true)
        .reply(200, 'ok');

      nock('https://api.pagerduty.com/')
        .post('/incidents', incident2)
        .query(true)
        .reply(200, 'ok');

      nock('https://incomingUrl/').post('/').reply(200, 'ok');

      return pd.checkSchedulesIds((checkErr, res) => {
        if (checkErr) { return done(checkErr); }
        if (!res) {
          return done(new Error('Check failed'));
        }
        return pd.processSchedulesFromConfig((err, msg) => {
          if (err) { return done(err); }
          message = msg;
          return done(err);
        });
      });
    })
  );

  it('Check if there are 2 returned messages', () => {
    assert.isArray(message);
    return assert.lengthOf(message, 2);
  });

  return it('Check returned messages if they contain "Primary and Secondary"', () =>
    (() => {
      const result = [];
      message.forEach((singleMessage) => {
        debug(singleMessage);
        assert.isObject(singleMessage);
        assert.include(singleMessage.schedules, 'Primary');
        result.push(assert.include(singleMessage.schedules, 'Secondary'));
      });
      return result;
    })()
  );
});


describe('Compare schedules on specific days', () => {
  let message = null;

  before(done =>
    config.setupConfig(configWithDaysPath, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries-days.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries-days.json`);

      nock('https://api.pagerduty.com/')
        .post('/incidents', incident)
        .query(true)
        .reply(200, 'ok');

      nock('https://incomingUrl/').post('/').reply(200, 'ok');

      return pd.checkSchedulesIds((checkErr, res) => {
        if (checkErr) { return done(checkErr); }
        if (!res) {
          return done(new Error('Check failed'));
        }
        return pd.processSchedulesFromConfig((err, msg) => {
          if (err) { return done(err); }
          message = msg;
          return done(err);
        });
      });
    })
  );

  it('Check if there is 1 returned message', () => {
    assert.isArray(message);
    return assert.lengthOf(message, 1);
  });

  it('Check if the returned message contains "Primary and Secondary"', () => {
    message.forEach((singleMessage) => {
      debug(singleMessage);
      assert.isObject(singleMessage);
      assert.include(singleMessage.schedules, 'Primary');
      assert.include(singleMessage.schedules, 'Secondary');
    });
  });
});

describe('Compare schedules with no overlap', () => {
  let message = null;

  before((done) => {
    config.setupConfig(configPath, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries-no-overlap.json`);

      return pd.checkSchedulesIds((checkErr, res) => {
        if (checkErr) { return done(checkErr); }
        if (!res) {
          return done(new Error('Check failed'));
        }
        return pd.processSchedulesFromConfig((err, msg) => {
          if (err) { return done(err); }
          message = msg;
          return done(err);
        });
      });
    });
  });

  return it('Check that there are no returned messages', () => {
    assert.isArray(message);
    return assert.isEmpty(message);
  });
});
