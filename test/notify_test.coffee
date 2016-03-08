{assert} = require 'chai'
nock     = require 'nock'
nconf    = require 'nconf'
debug    = require('debug')('pagerduty-overrides:tests')

config   = require '../src/config'
notify   = require '../src/notify'

configPath = __dirname + '/fixtures/config.json'

# https://github.com/chenka/node-slackr/blob/master/test/index.coffee
describe 'Test send message using notify.send', ->

  actual = null

  before (done) ->

    expectBody =
      text:"Message"
      channel:"#general"

    config.setupConfig configPath, (err) ->
      if err then return done err
      nock('https://incomingUrl').post("/", expectBody)
      .reply(200, 'ok')

      configSchedules = nconf.get('SCHEDULES')
      options = configSchedules[0]['NOTIFICATIONS']
      message = "Message"

      notify.send options, message, (err, result) ->
        if err then return done err
        actual = result
        done()

  it 'Check result from send notification', ->
    assert.equal 'ok', actual
