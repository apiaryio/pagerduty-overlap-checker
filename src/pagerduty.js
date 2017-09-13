async     = require 'async'
nconf     = require 'nconf'
_         = require 'underscore'
debug     = require('debug')('pagerduty-overrides')
notify    = require './notify'
pdApi    = require './pagerduty-api'

# Get schedule for ID and 2 weeks
getSchedule = (id, cb) ->
  if nconf.get('WEEKS_TO_CHECK') > 0
    week = 7 * 86400 * 1000
    timeNow = new Date()
    timeUntil = new Date(timeNow.getTime() + nconf.get('WEEKS_TO_CHECK') * week)

    scheduleOpts =
      qs:
        'schedule_ids[]': id
        until: timeUntil.toISOString()
        since: timeNow.toISOString()


    pdApi.send "/oncalls", scheduleOpts, (err, res, body) ->
      if err
        console.log "Request send error:", err
        return cb err

      if res.statusCode isnt 200 then return cb new Error("Entries returned status code #{res.statusCode}")
      cb err, id: id, entries: body.oncalls
  else
    cb new Error "Missing WEEKS_TO_CHECK settings"

# Get all schedules and returns their ids
getSchedulesIds = (cb) ->
  debug("Getting schedules from PD")
  pdApi.send "/schedules", {}, (err, res, body) ->
    if err
      console.log "Request send error:", err
      return cb err

    debug('Returned status code:', res.statusCode)
    schedulesIds = []

    for schedule in body.schedules
      schedulesIds.push(schedule.id)
      # UWAGA UWAGA - side effect follows!
      # it's easier, cheaper and more comprehensive to load schedule names here and temporarily store them using nconf
      nconf.set("schedulesNames:#{schedule.id}", schedule.name)

    debug("Schedules Ids from PD: ", schedulesIds)
    debug("Schedules Names from PD: ", nconf.get("schedulesNames"))
    cb null, schedulesIds

# Check if all schedules defined in config are available in PD
checkSchedulesIds = (cb) ->
  configSchedules = nconf.get('SCHEDULES')
  listIds = []
  for ids in configSchedules
    listIds.push ids['SCHEDULE']
  configSchedulesIds =  _.uniq(_.flatten(listIds))
  debug("Schedules Ids from config: ", configSchedulesIds)
  getSchedulesIds (err, schedulesIds) ->
    if err then return cb err
    debug('intersection: ', _.intersection(configSchedulesIds, schedulesIds).length)
    debug('config: ', configSchedulesIds.length)
    if (_.intersection(configSchedulesIds, schedulesIds).length) is configSchedulesIds.length
      cb null, true
    else
      cb null, false

processSchedulesFromConfig = (done) ->
  messages = []
  configSchedules = nconf.get('SCHEDULES')
  debug('configSchedules:', configSchedules.length)
  async.forEach configSchedules, (processedConfig, cb) ->
    debug('Process schedule:', )
    async.mapSeries processedConfig['SCHEDULE'], (i, next) ->
      getSchedule i, next
    , (err, results) ->
      if err then return cb err
      if results
        processSchedules results, processedConfig['EXCLUSION_DAYS'], (err, message) ->
          debug('processSchedules:', processedConfig)
          if message isnt "OK"
            messages = messages.concat(message)
            if processedConfig['NOTIFICATIONS']
              debug('Sending notifications.')
              return sendNotification processedConfig['NOTIFICATIONS'], message, cb
          return cb()
      else
        return cb new Error "No schedule to process."
  , (err) ->
    if err then return done err
    done null, messages

sendNotification = (options, message, cb) ->
  debug("NOTIFICATIONS:", message)
  debug("NOTIFICATIONS-OPTIONS:", options)
  notify.send options, message, (err) ->
    cb err

processSchedules = (allSchedules, days = [], cb) ->
  if typeof days is 'function'
    [cb, days] = [days, []]
  messages = []
  duplicities = {}
  debug('allSchedules:', allSchedules)
  for schedule in allSchedules
    debug('schedule:', JSON.stringify(schedule))
    otherSchedules = _.without(allSchedules, schedule)
    debug('otherSchedules:',JSON.stringify(otherSchedules))
    for entry in schedule.entries
      debug('checking entry: ', JSON.stringify(entry))
      myStart = entry.start
      myEnd = entry.end
      myUserId = entry.user.id
      myUserName = entry.user.summary
      duplicities.myUserName ?= []
      for crossSchedule in otherSchedules
        for crossCheckEntry in crossSchedule.entries
          overlap = false
          startDate = new Date(myStart)
          day = getDayAbbrev(startDate.getUTCDay())

          scheduleId = nconf.get("schedulesNames:#{schedule.id}")
          crossScheduleId = nconf.get("schedulesNames:#{crossSchedule.id}")

          message = {user: myUserName, userId: myUserId, schedules: [scheduleId, crossScheduleId], date: startDate, crossDate: new Date(crossCheckEntry.start)}

          if myStart <= crossCheckEntry.start < myEnd and
              crossCheckEntry.user.id == myUserId
            overlap = true

            if day in Object.keys(days)

              if days[day]?.start? and days[day]?.end?
                exclusionStartTime = days[day].start.split(':')
                exclusionEndTime = days[day].end.split(':')
                exclusionStartDate = new Date(myStart)
                exclusionStartDate.setUTCHours(exclusionStartTime[0])
                exclusionStartDate.setUTCMinutes(exclusionStartTime[1])
                exclusionEndDate = new Date(myStart)
                exclusionEndDate.setUTCHours(exclusionEndTime[0])
                exclusionEndDate.setUTCMinutes(exclusionEndTime[1])


                if exclusionStartDate <= startDate < exclusionEndDate
                  debug('excluded:', message)
                  overlap = false
              else
                overlap = false

          if overlap and crossCheckEntry.start not in duplicities.myUserName
            duplicities.myUserName.push(crossCheckEntry.start)
            messages.push message
  debug(_.uniq(messages))
  if messages.length is 0
    cb null, "OK"
  else
    cb null, _.uniq(messages)

getDayAbbrev = (utcDay) ->
  days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return days[utcDay]

module.exports = {
  getSchedulesIds
  checkSchedulesIds
  processSchedules
  processSchedulesFromConfig
  sendNotification
}