assert   = require('chai').assert
nock     = require 'nock'
nconf    = require 'nconf'
debug    = require('debug')('pagerduty-overrides:tests')

config   = require '../src/config'
pd       = require '../src/pagerduty'

configPath = __dirname + '/fixtures/config.json'
configWithDaysPath = __dirname + '/fixtures/config-days.json'
configWrongPath = __dirname + '/fixtures/config-wrong.json'

nock.disableNetConnect();

describe 'Get schedules Ids', ->
  schedules = null

  before (done) ->
    config.setupConfig configPath, (err) ->
      if err then return done err
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
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

      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
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

      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
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
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/schedules.json')

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/entries.json')

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/entries.json')

      nock('https://api.pagerduty.com/')
        .post('/incidents', require('./fixtures/incident.json'))
        .query(true)
        .reply(200, 'ok')

      nock('https://api.pagerduty.com/')
        .post('/incidents', require('./fixtures/incident2.json'))
        .query(true)
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

  it 'Check returned messages if containes "Primary and Secondary"', ->
    assert.isArray message
    assert.lengthOf message, 2
    for singleMessage in message
      debug(singleMessage)
      assert.isObject singleMessage
      assert.include singleMessage.schedules, "Primary"
      assert.include singleMessage.schedules, "Secondary"


describe 'Compare schedules on specific days', ->

  message = null

  before (done) ->
    config.setupConfig configWithDaysPath, (err) ->
      if err then return done err
      nock('https://api.pagerduty.com/')
        .get('/schedules')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/schedules.json')

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/entries-days.json')

      nock('https://api.pagerduty.com/')
        .get('/oncalls')
        .query(true)
        .replyWithFile(200, __dirname + '/fixtures/entries-days.json')

      nock('https://api.pagerduty.com/')
        .post('/incidents', require('./fixtures/incident.json'))
        .query(true)
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

  it 'Check returned messages if containes "Primary and Secondary"', ->
    assert.isArray message
    assert.lengthOf message, 1
    for singleMessage in message
      debug(singleMessage)
      assert.isObject singleMessage
      assert.include singleMessage.schedules, "Primary"
      assert.include singleMessage.schedules, "Secondary"
