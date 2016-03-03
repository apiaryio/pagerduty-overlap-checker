async     = require 'async'
request   = require 'request'
nconf     = require 'nconf'
_         = require 'underscore'
debug     = require('debug')('pagerduty-overrides')

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
  configSchedules = _.flatten(nconf.get('SCHEDULES'))
  debug("Schedules Ids from config: ", configSchedules)
  getSchedulesIds (err, schedulesIds) ->
    if err then return cb err
    debug('intersection: ', _.intersection(configSchedules, schedulesIds).length)
    debug('config: ', configSchedules.length)
    if (_.intersection(configSchedules, schedulesIds).length) is configSchedules.length
      cb null, true
    else
      cb null, false

processSchedulesFromConfig = (cb) ->
  configSchedules = nconf.get('SCHEDULES')
  async.map configSchedules, (i, next) ->
    getSchedule i.id, next
  , (err, results) ->
    debug(results)
    cb null, results

processSchedules = (allSchedules, cb) ->
  schedulesMap = {}

  for schedule in allSchedules
    otherSchedules = _.without(allSchedules, schedule)

    for entry in schedulesMap[schedule.id]
      myStart = entry.start
      debug(myStart)
      myEnd = entry.end
      debug(myEnd)
      myUserId = entry.user.id
      debug(myUserId)
      myUserName = entry.user.name
      debug(myUserName)
      for crossSchedule in otherSchedules
        for crossCheckEntry in schedulesMap[crossSchedule.id]
          if myStart <= crossCheckEntry.start < myEnd and
              crossCheckEntry.user.id == myUserId
            message = """Overlapping duty found for user #{myUserName}
              from #{myStart} to #{myEnd} on schedule ID #{schedule.id}!"""
            console.log message
#
# sendNotification = (message, cb) ->
#   debug('sendNotification: ', message)
#   cb()


module.exports = {
  pdGet
  getSchedulesIds
  checkSchedulesIds
  processSchedules
  processSchedulesFromConfig
}
