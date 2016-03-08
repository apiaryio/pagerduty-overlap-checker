config   = require './src/config'
nconf    = require 'nconf'
pd       = require './src/pagerduty'

configPath = __dirname + '/config.json'

config.setupConfig configPath, (err) ->
  if err then console.error err
  pd.checkSchedulesIds (err, res) ->
    if err then console.error err
    unless res
      console.error "Check failed"
    else
      pd.processSchedulesFromConfig (err, msg) ->
        if err
          console.error(err)
        else
          console.log(msg)
