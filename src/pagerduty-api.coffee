_         = require 'underscore'
debug     = require('debug')('pagerduty-overrides')
request   = require 'request'
nconf     = require 'nconf'
url      = require 'url'

# Factory for sending request to PD API
send = (endpointPath, overrideOptions, cb) ->
  debug("Calling #{endpointPath} with options:", overrideOptions)
  sharedOptions =
    uri: url.resolve 'https://api.pagerduty.com', endpointPath
    method: 'GET'
    json: true

  if typeof overrideOptions is 'function'
    cb = overrideOptions
    overrideOptions = {}

  _.extend sharedOptions, overrideOptions

  sharedOptions.headers ?= []
  sharedOptions.headers.Authorization ?= 'Token token=' + nconf.get('PAGERDUTY_READ_ONLY_TOKEN')
  sharedOptions.headers.Accept =  'application/vnd.pagerduty+json;version=2'
  sharedOptions.headers['Content-Type'] = 'application/json'

  sharedOptions.qs ?= []
  sharedOptions.qs.limit = 100
  sharedOptions.qs.timezone = 'UTC'

  debug('Calling request with: ', sharedOptions)
  request sharedOptions, cb

module.exports = {
  send
}
