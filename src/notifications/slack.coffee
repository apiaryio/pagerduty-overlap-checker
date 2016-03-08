Slack     = require 'node-slackr'
nconf     = require 'nconf'
debug     = require('debug')('pagerduty-overrides:notifications')

# https://www.npmjs.com/package/node-slackr
notify = (options, message, cb) ->
  if options.webhookUrl
    slack = new Slack(options.webhookUrl)
    slack.notify message, (err, result) ->
      if err then return cb err
      cb null, result
  else
    cb new Error "Missing Slack webhook URL."

module.exports = {
  notify
}
