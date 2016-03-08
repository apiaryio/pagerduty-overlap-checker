request   = require 'request'
debug     = require('debug')('pagerduty-overrides:notifications')

createPagerDutyIncident = (options, message, cb) ->
  details    ?= {}
  debug("Creating PD incident #{options.description}")

  unless options.serviceKey
    cb new Error "Missing PD service key"
  else
    request
      uri:  'https://events.pagerduty.com/generic/2010-04-15/create_event.json'
      method: "POST"
      json:
        service_key: options.serviceKey
        event_type: "trigger",
        description: options.description or message
        details:
          options.details

    , (err, res, body) ->
      if body?.errors?.length > 0
        err ?= new Error "INCIDENT_CREATION_FAILED Cannot create event: #{JSON.stringify body.errors}"
      if res.statusCode isnt 200 and res.statusCode isnt 201
        err ?= new Error "INCIDENT_CREATION_FAILED Creating incident failed with status #{res.statusCode}. Returned body: #{JSON.stringify body}"
      if err
        debug("INCIDENT_CREATION_FAILED: ", err)
      cb err


notify = (options, message, cb) ->
  createPagerDutyIncident options, message, cb

module.exports = {
  notify
}
