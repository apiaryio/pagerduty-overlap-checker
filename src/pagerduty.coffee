async     = require 'async'
request   = require 'request'
_         = require 'underscore'
debug     = require('debug')('pagerduty-overrides')

PAGERDUTY_RO_TOKEN   = process.env.PAGERDUTY_RO_TOKEN
PAGERDUTY_COMMON_KEY = process.env.PAGERDUTY_COMMON_KEY
PAGERDUTY_API_URL    = process.env.PAGERDUTY_API_URL or 'https://apiary.pagerduty.com/api/v1'

pdGet = (endpointPath, overrideOptions, cb) ->
  sharedOptions =
    uri: PAGERDUTY_API_URL + endpointPath
    method: 'GET'
    json: true
    headers:
      'Authorization': 'Token token=' + PAGERDUTY_RO_TOKEN

  if typeof overrideOptions is 'function'
    cb = overrideOptions
    overrideOptions = {}

  _.extend sharedOptions, overrideOptions

  request sharedOptions, cb


getSchedule = (id, cb) ->
  week = 7 * 86400 * 1000
  timeNow = new Date()
  timeUntil = new Date(timeNow.getTime() + 2 * week)

  scheduleOpts =
    form:
      until: timeUntil.toISOString()
      since: timeNow.toISOString()

  pdGet "/schedules/#{id}/entries", scheduleOpts, (err, res, body) ->
    if res.statusCode isnt 200 then return cb new Error(
      "Entries returned status code #{res.statusCode}"
    )

    cb err, id: id, entries: body.entries

pdGet "/schedules", (err, res, body) ->
  schedules = body.schedules
  if err then return console.log "Cannot get request:", done err

  async.map schedules, (i, next) ->
    getSchedule i.id, next

  , (err, results) ->
    if err
      console.error "Cannot get schedules", err
      return done err
    processSchedules results

processSchedules = (allSchedules, cb) ->
  schedulesMap = {}

  for i in allSchedules
    # this line is temporary for problems with overlaping duties between platform and user support
    if i.id isnt process.env.PAGERDUTY_SCHEDULE_USER_ID
      schedulesMap[i.id] = i.entries

  for schedule in allSchedules
    otherSchedules = _.without(allSchedules, schedule)

    for entry in schedulesMap[schedule.id]
      myStart = entry.start
      myEnd = entry.end
      myUserId = entry.user.id
      myUserName = entry.user.name

      for crossSchedule in otherSchedules
        for crossCheckEntry in schedulesMap[crossSchedule.id]
          if myStart <= crossCheckEntry.start < myEnd and
              crossCheckEntry.user.id == myUserId
            message = """Overlapping duty found for user #{myUserName}
              from #{myStart} to #{myEnd} on schedule ID #{schedule.id}!"""
            sendNotification message, ->
              cb new Error "Overlapping duties found!"

sendNotification = (message, cb) ->
  debug('sendNotification: ', message)
  cb()
