Slack     = require 'node-slackr'
nconf     = require 'nconf'
async     = require 'async'
request   = require 'request'
debug     = require('debug')('pagerduty-overrides:notifications')
pdApi    = require './pagerduty-api'

createPagerDutyIncident = (options, message, cb) ->
  debug("Creating PD incident #{JSON.stringify(message)} with options #{JSON.stringify(options)}")

  unless options.pdToken and options.serviceId and options.from
    cb new Error "Missing PAGERDUTY settings (you'll need PAGERDUTY_TOKEN, PAGERDUTY_SERVICE_ID and PAGERDUTY_FROM)"

  unless message.userId or options.escalationPolicyId
    cb new Error "No userId or escalation policy specified"

  else
    incident =
      type: "incident"
      title: "On-call overlap found!"
      service:
        id: options.serviceId
        type: "service_reference"
      body:
        type: "incident_body"
        details: message.messages.join('\n')

    if options.escalationPolicyId
      incident.escalationPolicy =
        id: options.escalationPolicyId
        type: "escalation_policy_reference"
    else
      incident.assignments = [
        assignee :
          id: message.userId
          type: "user_reference"
      ]

    incidentOptions =
      method: "POST"
      json:
        incident: incident
      headers:
        From: options.from
        Authorization: 'Token token=' + options.pdToken

    pdApi.send '/incidents', incidentOptions, (err, res, body) ->
      if body?.errors?.length > 0
        err ?= new Error "INCIDENT_CREATION_FAILED Errors: #{JSON.stringify body.errors}"
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
          outputMessage += """#{message.user}: #{message.schedules[0]} and #{message.schedules[1]} on #{message.date.toUTCString()}\n"""
      when 'markdown'
        outputMessage = "Following overlaps found:\n"
        for message in messages
          outputMessage += """*#{message.user}:* `#{message.schedules[0]}` and `#{message.schedules[1]}` on #{message.date.toUTCString()}\n"""
      when 'json'
        outputMessage = messages.reduce((acc, curr)->
          acc[curr.userId] ?= {}
          acc[curr.userId].userId ?= curr.userId
          acc[curr.userId].user ?= curr.user
          acc[curr.userId].messages ?= []
          acc[curr.userId].messages.push("#{curr.schedules[0]} and #{curr.schedules[1]} #{curr.date.toUTCString()}")
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
        if not options['PAGERDUTY'] and not options['PAGERDUTY_TOKEN']
          debug('No PAGERDUTY options defined')
        else if (options['PAGERDUTY']['PAGERDUTY_TOKEN'] or options['PAGERDUTY_TOKEN']) and options['PAGERDUTY']['PAGERDUTY_SERVICE_ID'] and options['PAGERDUTY']['PAGERDUTY_FROM']
          debug('Found PD token - creating an incident')
          pdOptions = {}
          pdOptions.pdToken = options['PAGERDUTY']['PAGERDUTY_TOKEN'] or options['PAGERDUTY_TOKEN']
          pdOptions.serviceId = options['PAGERDUTY']['PAGERDUTY_SERVICE_ID']
          pdOptions.escalationPolicyId = options['PAGERDUTY']['PAGERDUTY_ESCALATION_POLICY_ID']
          pdOptions.from = options['PAGERDUTY']?['PAGERDUTY_FROM']
          messagesByUser = formatMessage(message, 'json')
          async.each(messagesByUser,
            (item, cb) ->
              createPagerDutyIncident pdOptions, item, cb
            (err) ->
              next err)
        else
          console.log("No PD options defined or defined incorrectly (#{JSON.stringify(options['PAGERDUTY'])})")
          next()
    ], (err, results) ->
      if err then return cb err
      output = results.filter (n) -> n isnt undefined
      cb null, output

module.exports = {
  send
}
