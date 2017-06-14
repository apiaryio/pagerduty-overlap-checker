Slack     = require 'node-slackr'
nconf     = require 'nconf'
async     = require 'async'
request   = require 'request'
debug     = require('debug')('pagerduty-overrides:notifications')

createPagerDutyIncident = (options, message, cb) ->
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
        description: "On-call overlap found!"
        details: message
    , (err, res, body) ->
      if body?.errors?.length > 0
        err ?= new Error "INCIDENT_CREATION_FAILED Cannot create event: #{JSON.stringify body.errors}"
      if res?.statusCode isnt 200 and res?.statusCode isnt 201
        err ?= new Error "INCIDENT_CREATION_FAILED Creating incident failed with status #{res.statusCode}. Returned body: #{JSON.stringify body}"
      if err
        debug("INCIDENT_CREATION_FAILED: ", err)
      cb err

# https://www.npmjs.com/package/node-slackr
createSlackMessage = (options, message, cb) ->
  if options.webhookUrl
    slack = new Slack(options.webhookUrl)
    slack.notify message, (err, result) ->
      if err
        console.error("SLACK_SEND_MESSAGE_FAILED:", err)
        return cb err
      cb null, result
  else
    cb new Error "Missing Slack webhook URL."

# Input is array of messages is we have more overlaps
formatMessage = (messages, option = 'plain') ->
  if typeof messages is 'string'
    return messages
  else
    switch option
      when 'plain'
        outputMessage = "_Following overlaps found:_\n"
        for message in messages
          outputMessage += """#{message.user}: #{message.schedules[0]} and #{message.schedules[1]} on #{message.date.toLocaleString()}\n"""
      when 'markdown'
        outputMessage = "Following overlaps found:\n"
        for message in messages
          outputMessage += """*#{message.user}:* `#{message.schedules[0]}` and `#{message.schedules[1]}` on #{message.date.toLocaleString()}\n"""
      when 'json'
        outputMessage = messages.reduce((acc, curr)->
          acc[curr.user] ?= []
          acc[curr.user].push("#{curr.schedules[0]} and #{curr.schedules[1]} on #{curr.date.toLocaleString()}")
          return acc
        , {})

  debug('Notification - formatMessage option: ', option)
  debug('Notification - formatMessage: ', outputMessage)
  return outputMessage

send = (options, message, cb) ->
  debug('send:', options, message)

  async.parallel [
    (next) ->
        if options['SLACK'] or options['SLACK_WEBHOOK_URL']?
          debug('Found Slack webhook, sending a notification')
          slackMessage = {}
          slackMessage.text = formatMessage(message, 'markdown')
          slackMessage.channel = options['SLACK']?['CHANNEL']
          slackOptions = {}
          slackOptions.webhookUrl = options['SLACK']?['SLACK_WEBHOOK_URL'] or options['SLACK_WEBHOOK_URL']
          createSlackMessage slackOptions, slackMessage, next
        else
          debug('No Slack webhook defined')
          next()
    (next) ->
        if options['PAGERDUTY_TOKEN']?
          debug('Found PD token - creating an incident')
          pdOptions = {}
          pdOptions.serviceKey = options['PAGERDUTY_TOKEN']
          pdOptions.description = message
          createPagerDutyIncident pdOptions, formatMessage(message, 'json'), next
        else
          debug('No PD token defined')
          next()
    ], (err, results) ->
      if err then return cb err
      output = results.filter (n) -> n isnt undefined
      cb null, output

module.exports = {
  send
}
