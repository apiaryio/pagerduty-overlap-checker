async     = require 'async'
request   = require 'request'
nconf     = require 'nconf'
_         = require 'underscore'
debug     = require('debug')('pagerduty-overrides')

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

# getSchedule = (id, cb) ->
#   week = 7 * 86400 * 1000
#   timeNow = new Date()
#   timeUntil = new Date(timeNow.getTime() + 2 * week)
#
#   scheduleOpts =
#     form:
#       until: timeUntil.toISOString()
#       since: timeNow.toISOString()
#
#   pdGet "/schedules/#{id}/entries", scheduleOpts, (err, res, body) ->
#     if res.statusCode isnt 200 then return cb new Error(
#       "Entries returned status code #{res.statusCode}"
#     )
#
#     cb err, id: id, entries: body.entries


getSchedulesIds = (cb) ->
  debug("Getting schedules from PD")
  pdGet "/schedules", {}, (err, res, body) ->
    debug('Returned status code:', res.statusCode)
    if err
      console.log "Cannot get request:", err
      return cb err
    schedulesIds = _.pluck(body.schedules, "id")
    debug("Schedules from PD: ", schedulesIds)
    cb null, schedulesIds

    # async.map schedules, (i, next) ->
    #   getSchedule i.id, next
    #
    # , (err, results) ->
    #   if err
    #     console.error "Cannot get schedules", err
    #     return done err
    #   processSchedules results

# processSchedules = (allSchedules, cb) ->
#   schedulesMap = {}
#
#   for i in allSchedules
#     # this line is temporary for problems with overlaping duties between platform and user support
#     if i.id isnt process.env.PAGERDUTY_SCHEDULE_USER_ID
#       schedulesMap[i.id] = i.entries
#
#   for schedule in allSchedules
#     otherSchedules = _.without(allSchedules, schedule)
#
#     for entry in schedulesMap[schedule.id]
#       myStart = entry.start
#       myEnd = entry.end
#       myUserId = entry.user.id
#       myUserName = entry.user.name
#
#       for crossSchedule in otherSchedules
#         for crossCheckEntry in schedulesMap[crossSchedule.id]
#           if myStart <= crossCheckEntry.start < myEnd and
#               crossCheckEntry.user.id == myUserId
#             message = """Overlapping duty found for user #{myUserName}
#               from #{myStart} to #{myEnd} on schedule ID #{schedule.id}!"""
#             sendNotification message, ->
#               cb new Error "Overlapping duties found!"
#
# sendNotification = (message, cb) ->
#   debug('sendNotification: ', message)
#   cb()


module.exports = {
  pdGet
  getSchedulesIds
}
