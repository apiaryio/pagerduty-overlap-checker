assert   = require('chai').assert
nock     = require 'nock'
nconf    = require 'nconf'
debug    = require('debug')('pagerduty-overrides:tests')

config   = require '../src/config'
pd       = require '../src/pagerduty'

configPath = __dirname + '/fixtures/config.json'
configWrongPath = __dirname + '/fixtures/config-wrong.json'

nock.disableNetConnect();

describe 'Get schedules Ids', ->
  schedules = null

  before (done) ->
    config.setupConfig configPath, (err) ->
      if err then return done err
      nock('https://acme.pagerduty.com/api/v1')
        .get('/schedules')
        .replyWithFile(200, __dirname + '/fixtures/schedules.json')

      pd.getSchedulesIds (err, schedulesIds) ->
        schedules = schedulesIds
        done err

  it 'Check how many schedules', ->
    assert.equal schedules.length, 2

describe 'Check schedules', ->
  schedules = null

  before (done) ->
    config.setupConfig configPath, (err) ->
      if err then return done err

      nock('https://acme.pagerduty.com/api/v1')
        .get('/schedules')
        .replyWithFile(200, __dirname + '/fixtures/schedules.json')

      pd.checkSchedulesIds (err, res) ->
        schedules = res
        done err

  it 'Check if config ids are in pagerduty schedules', ->
    assert.ok schedules

describe 'Check schedules with wrong config', ->
  schedules = null

  before (done) ->
    config.setupConfig configWrongPath, (err) ->
      if err then return done err

      nock('https://acme.pagerduty.com/api/v1')
        .get('/schedules')
        .replyWithFile(200, __dirname + '/fixtures/schedules.json')

      pd.checkSchedulesIds (err, res) ->
        schedules = res
        done err

  it 'Check if config ids are in pagerduty schedules', ->
    assert.notOk schedules

describe 'Compare schedules', ->

  message = null

  before (done) ->
    config.setupConfig configPath, (err) ->
      if err then return done err
      nock('https://acme.pagerduty.com/api/v1')
        .get('/schedules')
        .replyWithFile(200, __dirname + '/fixtures/schedules.json')

      nock('https://acme.pagerduty.com/api/v1')
        .get('/schedules/PWEVPB6/entries')
        .replyWithFile(200, __dirname + '/fixtures/entries.json')

      nock('https://acme.pagerduty.com/api/v1')
        .get('/schedules/PT57OLG/entries')
        .replyWithFile(200, __dirname + '/fixtures/entries.json')

      expectedBody = {
          service_key:"111111111111",
          event_type:"trigger",
          description:[
            "Overlapping duty found for user Gregory\nfrom 2012-08-19T00:00:00-04:00 to 2012-08-19T12:00:00-04:00 on schedule ID PWEVPB6!",
            "Overlapping duty found for user Halie\nfrom 2012-08-19T12:00:00-04:00 to 2012-08-20T00:00:00-04:00 on schedule ID PWEVPB6!",
            "Overlapping duty found for user Gregory\nfrom 2012-08-19T00:00:00-04:00 to 2012-08-19T12:00:00-04:00 on schedule ID PT57OLG!",
            "Overlapping duty found for user Halie\nfrom 2012-08-19T12:00:00-04:00 to 2012-08-20T00:00:00-04:00 on schedule ID PT57OLG!"
          ],
          details:{subject:"PagerDuty overlap incident"}
      }
      nock('https://events.pagerduty.com/generic/2010-04-15/')
        .post('/create_event.json', expectedBody)
        .reply(200, 'ok')

      nock('https://incomingUrl/').post("/").reply(200, 'ok')

      pd.checkSchedulesIds (err, res) ->
        if err then return done err
        unless res
          return done new Error("Check failed")
        pd.processSchedulesFromConfig (err, msg) ->
          if err then return done err
          message = msg
          done err

  it 'Check returned messages if containes "Overlapping duty found for user"', ->
    assert.isArray message
    assert.lengthOf message, 4
    for singleMessage in message
      debug(singleMessage)
      assert.include singleMessage, 'Overlapping duty found for user'


describe 'Get user id', ->

  expectedId = "PP1565R"
  actualId = null

  before (done) ->
    config.setupConfig configPath, (err) ->
      if err then return done err
      nock('https://acme.pagerduty.com/api/v1')
        .get('/users')
        .replyWithFile(200, __dirname + '/fixtures/users.json')

      pd.getUserId "john@example.com", (err, userId) ->
        if err then return done err
        actualId = userId
        done err
  it 'Check if userId is right', ->
    assert.equal expectedId, actualId

describe 'Override user schedule', ->
  actual = null
  expected = null
  userId = "PHLG109"
  scheduleId = "PIJ90N7"

  before (done) ->
    config.setupConfig configPath, (err) ->
      if err then return done err
      nock('https://acme.pagerduty.com/api/v1')
        .post("/schedules/#{scheduleId}/overrides")
        .replyWithFile(201, __dirname + '/fixtures/override.json')

      pd.overrideUser userId, scheduleId, 20, (err, overrideReponse) ->
        actual = overrideReponse
        done err

  it 'Check if userId is ok', ->
    assert.equal actual.user.id, userId
