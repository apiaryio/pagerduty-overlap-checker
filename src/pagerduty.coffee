async     = require 'async'
request   = require 'request'
nconf     = require 'nconf'
_         = require 'underscore'
debug     = require('debug')('pagerduty-overrides')
notify    = require './notify'

# Factory for sending request to PD API
pdGet = (endpointPath, overrideOptions, cb) ->
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

# Get schedule for ID and 2 weeks
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

# Get all schedules and returns their ids
getSchedulesIds = (cb) ->
  debug("Getting schedules from PD")
  pdGet "/schedules", {}, (err, res, body) ->
    debug('Returned status code:', res.statusCode)
    if err
      console.log "Cannot get request:", err
      return cb err
    schedulesIds = _.pluck(body.schedules, "id")
    debug("Schedules Ids from PD: ", schedulesIds)
    cb null, schedulesIds

# Check if all schedules defined in config are available in PD
checkSchedulesIds = (cb) ->
  configSchedules = nconf.get('SCHEDULES')
  listIds = []
  for ids in configSchedules
    listIds.push ids['SCHEDULE']
  debug("Schedules Ids from config: ", _.flatten(listIds))
  configSchedulesIds =  _.flatten(listIds)
  getSchedulesIds (err, schedulesIds) ->
    if err then return cb err
    debug('intersection: ', _.intersection(configSchedulesIds, schedulesIds).length)
    debug('config: ', configSchedulesIds.length)
    if (_.intersection(configSchedulesIds, schedulesIds).length) is configSchedulesIds.length
      cb null, true
    else
      cb null, false

processSchedulesFromConfig = (cb) ->
  configSchedules = nconf.get('SCHEDULES')
  debug('configSchedules:', configSchedules.length)
  processedConfig = null
  end = configSchedules.length - 1
  for index in [0..end]
    processedConfig = configSchedules[index]
    debug('Process schedule:', )
    async.mapSeries configSchedules[index]['SCHEDULE'], (i, next) ->
      getSchedule i, next
    , (err, results) ->
      if results
        processSchedules results, (err, message) ->
          debug('processSchedules:', processedConfig)
          if processedConfig['NOTIFICATIONS'] && message isnt "OK"
            debug('Notification sent.')
            sendNotification processedConfig['NOTIFICATIONS'], message
          cb null, message
      else
        cb new Error "No schedule to process."

sendNotification = (options, message) ->
  debug("NOTIFICATIONS:", message)
  debug("NOTIFICATIONS-OPTIONS:", options)
  notify.send options, message, (err) ->
    if err then console.error "Notification failed.", err

processSchedules = (allSchedules, cb) ->
  schedulesMap = {}
  messages = []
  debug('allSchedules:', allSchedules)
  for schedule in allSchedules
    debug('schedule:', schedule)
    otherSchedules = _.without(allSchedules, schedule)
    debug('otherSchedules:',otherSchedules)
    for entry in schedule.entries
      myStart = entry.start
      debug(myStart)
      myEnd = entry.end
      debug(myEnd)
      myUserId = entry.user.id
      debug(myUserId)
      myUserName = entry.user.name
      debug(myUserName)
      for crossSchedule in otherSchedules
        for crossCheckEntry in crossSchedule.entries
          if myStart <= crossCheckEntry.start < myEnd and
              crossCheckEntry.user.id == myUserId
            message = """Overlapping duty found for user #{myUserName}
              from #{myStart} to #{myEnd} on schedule ID #{schedule.id}!"""
            messages.push message
  debug(_.uniq(messages))
  if messages.length is 0
    cb null, "OK"
  else
    cb null, _.uniq(messages)

module.exports = {
  pdGet
  getSchedulesIds
  checkSchedulesIds
  processSchedules
  processSchedulesFromConfig
  sendNotification
}
