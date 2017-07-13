_         = require 'underscore'
debug     = require('debug')('pagerduty-overrides')
request   = require 'request'
nconf     = require 'nconf'
url      = require 'url'

# Factory for sending request to PD API
send = (endpointPath, overrideOptions, cb) ->
  debug("Calling #{endpointPath} with options:", overrideOptions)
  defaultOptions =
    uri: url.resolve 'https://api.pagerduty.com', endpointPath
    method: 'GET'
    json: true

  if typeof overrideOptions is 'function'
    cb = overrideOptions
    overrideOptions = {}

  _.extend defaultOptions, overrideOptions

  defaultOptions.headers ?= []
  defaultOptions.headers.Authorization ?= 'Token token=' + nconf.get('PAGERDUTY_READ_ONLY_TOKEN')
  defaultOptions.headers.Accept =  'application/vnd.pagerduty+json;version=2'
  defaultOptions.headers['Content-Type'] = 'application/json'

  defaultOptions.qs ?= []
  defaultOptions.qs.limit = 100
  defaultOptions.qs.timezone = 'UTC'

  debug('Calling request with: ', defaultOptions)
  request defaultOptions, cb

module.exports = {
  send
}
