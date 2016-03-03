{assert} = require 'chai'
nock     = require 'nock'
nconf    = require 'nconf'

config   = require '../src/config'
pd       = require '../src/pagerduty'

configPath = __dirname + '/fixtures/config.json'

describe 'Get schedules Ids', ->
  schedules = null

  before (done) ->
    config.setupConfig(configPath)

    nock('https://acme.pagerduty.com/api/v1')
      .get('/schedules')
      .replyWithFile(200, __dirname + '/fixtures/schedules.json')

    pd.getSchedulesIds (err, schedulesIds) ->
      schedules = schedulesIds
      done err

  it 'Check how many schedules', ->
    assert.equal schedules.length, 2
