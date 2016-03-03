{assert} = require 'chai'
config   = require '../src/config'
nconf    = require 'nconf'
pd       = require '../src/pagerduty'


describe 'Get schedules', ->
  schedules = null

  before (done) ->
    config.setupConfig(__dirname + '/../config.json')
    pd.getSchedulesIds (err, schedulesIds) ->
      schedules = schedulesIds
      done err

  describe 'Integration test', ->
    it 'Check how many schedules', ->
      assert.equal schedules.length, 5
