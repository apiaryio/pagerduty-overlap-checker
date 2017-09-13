/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert }   = require('chai');
const nock     = require('nock');
const nconf    = require('nconf');
const debug    = require('debug')('pagerduty-overrides:tests');

const config   = require('../src/config');
const notify   = require('../src/notify');

const configPath = __dirname + '/fixtures/config.json';

nock.disableNetConnect();

// https://github.com/chenka/node-slackr/blob/master/test/index.coffee
describe('Test send message using notify.send for both', function() {

  let actual = null;

  before(function(done) {
    const overlapDate = new Date();
    let message = {
      user: 'Test user',
      userId: '1234',
      schedules: ['TEST1', 'TEST2'],
      date: overlapDate,
      crossDate: overlapDate
    };

    const expectBody = {
      text:`Following overlaps found:\n*Test user:* \`TEST1\` and \`TEST2\` (the first starting on ${overlapDate.toUTCString()}, the second on ${overlapDate.toUTCString()})\n`,
      channel:"#channel-name"
    };

    return config.setupConfig(configPath, function(err) {
      if (err) { return done(err); }
      nock('https://incomingUrl')
        .post("/", expectBody)
        .query(true)
        .reply(200, 'ok');

      nock('https://api.pagerduty.com/')
        .post('/incidents')
        .query(true)
        .reply(200, 'ok');

      const configSchedules = nconf.get('SCHEDULES');
      const options = configSchedules[0]['NOTIFICATIONS'];
      message = {
        user: 'Test user',
        userId: '1234',
        schedules: ['TEST1', 'TEST2'],
        date: overlapDate,
        crossDate: overlapDate
      };

      return notify.send(options, [ message ], function(err, result) {
        if (err) { return done(err); }
        actual = result;
        return done();
      });
    });
  });

  return it('Check result from send notification', () => assert.equal('ok', actual));
});
