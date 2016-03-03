{assert} = require 'chai'
config   = require '../src/config'
nconf    = require 'nconf'
pd       = require '../src/pagerduty'

configPath = __dirname + '/../../config.json'

describe 'Get schedules Ids', ->
  schedules = null

  before (done) ->
    config.setupConfig(configPath)
    pd.getSchedulesIds (err, schedulesIds) ->
      schedules = schedulesIds
      done err

  it 'Check how many schedules', ->
    assert.equal schedules.length, 5

describe 'Check schedules', ->
  schedules = null

  before (done) ->
    config.setupConfig(configPath)
    pd.checkSchedulesIds (err, res) ->
      schedules = res
      done err

  it 'Check if config ids are in pagerduty schedules', ->
    assert.ok schedules

describe 'Compare schedules', ->

  message = null

  before (done) ->
    config.setupConfig(configPath)
    pd.checkSchedulesIds (err, res) ->
      if err then return done err
      unless res
        return done new Error("Check failed")
      pd.processSchedulesFromConfig (err, msg) ->
        if err then return done err
        message = msg
        done err

  it 'Test message', ->
    assert.equal message, 'OK'
