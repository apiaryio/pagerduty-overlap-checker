async     = require 'async'
nconf     = require 'nconf'
_         = require 'underscore'
debug     = require('debug')('pagerduty-overrides')
notify    = require './notify'
pd_api    = require './pagerduty-api'

# Get schedule for ID and 2 weeks
getSchedule = (id, cb) ->
  if nconf.get('WEEKS_TO_CHECK') > 0
    week = 7 * 86400 * 1000
    timeNow = new Date()
    timeUntil = new Date(timeNow.getTime() + nconf.get('WEEKS_TO_CHECK') * week)

    scheduleOpts =
      form:
        until: timeUntil.toISOString()
        since: timeNow.toISOString()

    pd_api.send "/schedules/#{id}/entries", scheduleOpts, (err, res, body) ->
      if res.statusCode isnt 200 then return cb new Error(
        "Entries returned status code #{res.statusCode}"
      )

      cb err, id: id, entries: body.entries
  else
    cb new Error "Missing WEEKS_TO_CHECK settings"

# Get all schedules and returns their ids
getSchedulesIds = (cb) ->
  debug("Getting schedules from PD")
  pd_api.send "/schedules", {}, (err, res, body) ->
    debug('Returned status code:', res.statusCode)
    if err
      console.log "Cannot get request:", err
      return cb err

    schedulesIds = []

    for schedule in body.schedules
      schedulesIds.push(schedule.id)
      # UWAGA UWAGA - side effect follows!
      # it's easier, cheaper and more comprehensive to load schedule names here and temporarily store them using nconf
      nconf.set("schedulesNames:#{schedule.id}", schedule.name)

    debug("Schedules Ids from PD: ", schedulesIds)
    debug("Schedules Names from PD: ", debug(nconf.get("schedulesNames")))
    cb null, schedulesIds

# Check if all schedules defined in config are available in PD
checkSchedulesIds = (cb) ->
  configSchedules = nconf.get('SCHEDULES')
  listIds = []
  for ids in configSchedules
    listIds.push ids['SCHEDULE']
  debug("Schedules Ids from config: ", _.flatten(listIds))
  configSchedulesIds =  _.uniq(_.flatten(listIds))
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
      if err then cb err
      if results
        processSchedules results, processedConfig['EXCLUSION_DAYS'], (err, message) ->
          messages = messages.concat(message)
          debug('processSchedules:', processedConfig)
          if processedConfig['NOTIFICATIONS'] && message isnt "OK"
            debug('Sending notifications.')
            sendNotification processedConfig['NOTIFICATIONS'], message, cb
      else
        cb new Error "No schedule to process."
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
      duplicities.myUserName ?= []
      for crossSchedule in otherSchedules
        for crossCheckEntry in crossSchedule.entries
          overlap = false
          startDate = new Date(myStart)
          day = getDayAbbrev(startDate.getUTCDay())

          scheduleId = nconf.get("schedulesNames:#{schedule.id}")
          crossScheduleId = nconf.get("schedulesNames:#{crossSchedule.id}")

          message = {user: myUserName, schedules: [scheduleId, crossScheduleId], date: startDate}

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

getUserId = (email, cb) ->

  userOptions =
    form:
      query: email

  pd_api.send "/users", userOptions, (err, res, body) ->
    if res.statusCode isnt 200 then return cb new Error(
      "Entries returned status code #{res.statusCode}"
    )
    userId = body.users[0].id
    cb err, userId

overrideUser = (userId, scheduleId, durationInMinutes = 30, cb) ->
  if userId and scheduleId

    duration = durationInMinutes * 60 * 1000
    startDate = new Date()
    endDate = new Date(startDate.getTime() + duration)

    sharedOptions =
      method: 'POST'
      json: false
      form:
        override:
          "user_id": userId
          "start": startDate.toISOString()
          "end": endDate.toISOString()

    pd_api.send "/schedules/#{scheduleId}/overrides", sharedOptions, (err, res, body) ->
      if err then return cb err
      if res.statusCode isnt 201 then return cb new Error(
        "Entries returned status code #{res.statusCode}"
      )
      reponseObject = JSON.parse(body)
      cb err, reponseObject.override

getDayAbbrev = (utcDay) ->
  days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return days[utcDay]

module.exports = {
  getSchedulesIds
  checkSchedulesIds
  processSchedules
  processSchedulesFromConfig
  sendNotification
  getUserId
  overrideUser
}
