{assert} = require 'chai'
config   = require '../src/config'
nconf    = require 'nconf'
debug    = require('debug')('pagerduty-overrides:tests')

describe 'Get config for PagerDuty Overrides', ->

  it 'NODE_ENV isn\'t set', ->
    assert.equal nconf.get('NODE_ENV'), undefined

  it 'PAGERDUTY_READ_ONLY_TOKEN isn\'t set', ->
    assert.equal nconf.get('PAGERDUTY_READ_ONLY_TOKEN'), undefined

describe 'Setup config and get config', ->

  before (done) ->
    config.setupConfig __dirname + '/fixtures/config.json', (err) ->
      done err

  it 'NODE_ENV isn\'t set', ->
    assert.equal nconf.get('NODE_ENV'), undefined

  it 'PAGERDUTY_READ_ONLY_TOKEN is set', ->
    assert.equal nconf.get('PAGERDUTY_READ_ONLY_TOKEN'), 'E7px6VVr3PVHZPJq51oa'
