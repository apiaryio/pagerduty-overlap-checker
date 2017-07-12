assert   = require('chai').assert
nock     = require 'nock'
nconf    = require 'nconf'
debug    = require('debug')('pagerduty-overrides:tests')

config   = require '../src/config'
notify   = require '../src/notify'

configPath = __dirname + '/fixtures/config.json'

nock.disableNetConnect();

# https://github.com/chenka/node-slackr/blob/master/test/index.coffee
describe 'Test send message using notify.send for both', ->

  actual = null

  before (done) ->
    message =
      user: 'Test user'
      userId: '1234'
      schedules: ['TEST1', 'TEST2']
      date: new Date()

    expectBody =
      text:"Following overlaps found:\n*Test user:* `TEST1` and `TEST2` on #{message.date.toUTCString()}\n"
      channel:"#channel-name"

    config.setupConfig configPath, (err) ->
      if err then return done err
      nock('https://incomingUrl')
        .post("/", expectBody)
        .query(true)
        .reply(200, 'ok')

      nock('https://api.pagerduty.com/')
        .post('/incidents')
        .query(true)
        .reply(200, 'ok')

      configSchedules = nconf.get('SCHEDULES')
      options = configSchedules[0]['NOTIFICATIONS']
      message =
        user: 'Test user'
        userId: '1234'
        schedules: ['TEST1', 'TEST2']
        date: new Date()

      notify.send options, [ message ], (err, result) ->
        if err then return done err
        actual = result
        done()

  it 'Check result from send notification', ->
    assert.equal 'ok', actual
