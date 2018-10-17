const { assert } = require('chai');
const nock = require('nock');
const debug = require('debug')('pagerduty-overrides:tests');

const config = require('../src/config');
const pd = require('../src/pagerduty');

const configPath = `${__dirname}/fixtures/config.json`;
const configWithDaysPath = `${__dirname}/fixtures/config-days.json`;
const configWrongPath = `${__dirname}/fixtures/config-wrong.json`;
const configDst = `${__dirname}/fixtures/config-dst.json`;
const configDst2 = `${__dirname}/fixtures/config-dst-2.json`;
const configOverTimeUntil = `${__dirname}/fixtures/config-over-time-until.json`;
const configBeforeTimeSince = `${__dirname}/fixtures/config-before-time-since.json`;

const incident = require('./fixtures/incident.json');
const incident2 = require('./fixtures/incident2.json');
const incidentBug27 = require('./fixtures/bug-27-incident.json');

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

describe('Compare schedules with overlap on a weekend, with one shift starting sooner', () => {
  let message = null;

  before((done) => {
    config.setupConfig(configWithDaysPath, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/bug-27-entries.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/bug-27-entries-cross.json`);

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

describe('Compare schedules with overlap on a weekend plus one day', () => {
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
        .replyWithFile(200, `${__dirname}/fixtures/bug-27-entries-plus-one-day.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/bug-27-entries-plus-one-day.json`);

      nock('https://api.pagerduty.com/')
        .post('/incidents', incidentBug27)
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

describe('Subtract excluded ranges', () => {
  const moment = config.moment;
  const excludedRanges = [
    moment.range([moment.tz('2012-08-10T15:00:00.000Z', 'CET'), moment.tz('2012-08-10T21:59:59.999Z', 'CET')]),
    moment.range([moment.tz('2012-08-17T15:00:00.000Z', 'CET'), moment.tz('2012-08-17T21:59:59.999Z', 'CET')]),
    moment.range([moment.tz('2012-08-10T22:00:00.000Z', 'CET'), moment.tz('2012-08-11T21:59:59.999Z', 'CET')]),
    moment.range([moment.tz('2012-08-17T22:00:00.000Z', 'CET'), moment.tz('2012-08-18T21:59:59.999Z', 'CET')]),
    moment.range([moment.tz('2012-08-04T22:00:00.000Z', 'CET'), moment.tz('2012-08-05T15:00:00.000Z', 'CET')]),
    moment.range([moment.tz('2012-08-11T22:00:00.000Z', 'CET'), moment.tz('2012-08-12T15:00:00.000Z', 'CET')]),
    moment.range([moment.tz('2012-08-18T22:00:00.000Z', 'CET'), moment.tz('2012-08-19T15:00:00.000Z', 'CET')]),
  ];

  const overlapRange = moment.range([moment.tz('2012-08-19T16:00:00.000Z', 'CET'), moment.tz('2012-08-20T04:00:00.000Z', 'CET')]);

  let result = [];

  before((done) => {
    config.setupConfig(configWithDaysPath, (configErr) => {
      if (configErr) { return done(configErr); }
      result = pd.subtract(overlapRange, excludedRanges);
      return done();
    });
  });

  it('Check there is some range left', () => {
    assert.isArray(result);
    const expectedResult = [{ start: '2012-08-19T16:00:00.000Z', end: '2012-08-20T04:00:00.000Z' }];
    assert.equal(JSON.stringify(result), JSON.stringify(expectedResult));
  });
});

describe('Compare schedules with overlap on a weekend, on a DST switch', () => {
  let message = null;

  before((done) => {
    config.setupConfig(configDst, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/dst-entries.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/dst-entries-cross.json`);

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

describe('Compare schedules with overlap on a weekend, on a DST switch - 2', () => {
  let message = null;

  before((done) => {
    config.setupConfig(configDst2, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/dst-2-entries.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/dst-2-entries-cross.json`);

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

describe('Compare schedules with records past TIME_UNTIL', () => {
  let message = null;

  before((done) => {
    config.setupConfig(configOverTimeUntil, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries-over-time-until.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries-cross-over-time-until.json`);

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

describe('Compare schedules with records before TIME_SINCE', () => {
  let message = null;

  before((done) => {
    config.setupConfig(configBeforeTimeSince, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/schedules.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries-before-time-since.json`);

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, `${__dirname}/fixtures/entries-cross-before-time-since.json`);

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
