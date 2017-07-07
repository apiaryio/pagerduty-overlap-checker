_         = require 'underscore'
debug     = require('debug')('pagerduty-overrides')
request   = require 'request'
nconf     = require 'nconf'

# Factory for sending request to PD API
send = (endpointPath, overrideOptions, cb) ->
  debug("Calling #{endpointPath} with options:", overrideOptions)
  sharedOptions =
    uri: nconf.get('PAGERDUTY_API_URL') + endpointPath
    method: 'GET'
    json: true
    headers:
      'Authorization': 'Token token=' + nconf.get('PAGERDUTY_READ_ONLY_TOKEN')

  if typeof overrideOptions is 'function'
    cb = overrideOptions
    overrideOptions = {}

  _.extend sharedOptions, overrideOptions

  debug('Calling request with: ', sharedOptions)
  request sharedOptions, cb

module.exports = {
  send : send
}
