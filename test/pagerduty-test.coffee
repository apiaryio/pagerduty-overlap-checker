assert   = require('chai').assert
nock     = require 'nock'
nconf    = require 'nconf'
debug    = require('debug')('pagerduty-overrides:tests')

config   = require '../src/config'
pd       = require '../src/pagerduty'

configPath = __dirname + '/fixtures/config.json'
configWrongPath = __dirname + '/fixtures/config-wrong.json'

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
