const { assert } = require('chai');
const moment = require('moment');
const nock = require('nock');
const nconf = require('nconf');

const config = require('../src/config');
const notify = require('../src/notify');

const configPath = `${__dirname}/fixtures/config.json`;

nock.disableNetConnect();

// https://github.com/chenka/node-slackr/blob/master/test/index.coffee
describe('Test send message using notify.send for both', () => {
  let actual = null;

  before((done) => {
    const overlapDate = moment().tz('CET');
    let message = {
      user: 'Test user',
      userId: '1234',
      schedules: ['TEST1', 'TEST2'],
      date: overlapDate,
      crossDate: overlapDate,
    };

    const expectBody = {
      text: `Following overlaps found:\n*Test user:* \`TEST1\` and \`TEST2\` (from ${notify.toISOstring(overlapDate)} to ${notify.toISOstring(overlapDate)})\n`,
      channel: '#channel-name',
    };

    return config.setupConfig(configPath, (configErr) => {
      if (configErr) { return done(configErr); }
      nock('https://incomingUrl')
        .post('/', expectBody)
        .query(true)
        .reply(200, 'ok');

      nock('https://api.pagerduty.com/')
        .post('/incidents')
        .query(true)
        .reply(200, 'ok');

      const configSchedules = nconf.get('SCHEDULES');
      const options = configSchedules[0].NOTIFICATIONS;
      message = {
        user: 'Test user',
        userId: '1234',
        schedules: ['TEST1', 'TEST2'],
        overlapStart: overlapDate,
        overlapEnd: overlapDate,
      };

      return notify.send(options, [message], (err, result) => {
        if (err) { return done(err); }
        actual = result;
        return done();
      });
    });
  });

  return it('Check result from send notification', () => assert.equal('ok', actual));
});
