/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async     = require('async');
const nconf     = require('nconf');
const _         = require('underscore');
const debug     = require('debug')('pagerduty-overrides');
const notify    = require('./notify');
const pdApi    = require('./pagerduty-api');

// Get schedule for ID and 2 weeks
const getSchedule = function(id, cb) {
  if (nconf.get('WEEKS_TO_CHECK') > 0) {
    const week = 7 * 86400 * 1000;
    const timeNow = new Date();
    const timeUntil = new Date(timeNow.getTime() + (nconf.get('WEEKS_TO_CHECK') * week));

    const scheduleOpts = {
      qs: {
        'schedule_ids[]': id,
        until: timeUntil.toISOString(),
        since: timeNow.toISOString()
      }
    };


    return pdApi.send("/oncalls", scheduleOpts, function(err, res, body) {
      if (err) {
        console.log("Request send error:", err);
        return cb(err);
      }

      if (res.statusCode !== 200) { return cb(new Error(`Entries returned status code ${res.statusCode}`)); }
      return cb(err, {id, entries: body.oncalls});
    });
  } else {
    return cb(new Error("Missing WEEKS_TO_CHECK settings"));
  }
};

// Get all schedules and returns their ids
const getSchedulesIds = function(cb) {
  debug("Getting schedules from PD");
  return pdApi.send("/schedules", {}, function(err, res, body) {
    if (err) {
      console.log("Request send error:", err);
      return cb(err);
    }

    debug('Returned status code:', res.statusCode);
    const schedulesIds = [];

    for (let schedule of Array.from(body.schedules)) {
      schedulesIds.push(schedule.id);
      // UWAGA UWAGA - side effect follows!
      // it's easier, cheaper and more comprehensive to load schedule names here and temporarily store them using nconf
      nconf.set(`schedulesNames:${schedule.id}`, schedule.name);
    }

    debug("Schedules Ids from PD: ", schedulesIds);
    debug("Schedules Names from PD: ", nconf.get("schedulesNames"));
    return cb(null, schedulesIds);
  });
};

// Check if all schedules defined in config are available in PD
const checkSchedulesIds = function(cb) {
  const configSchedules = nconf.get('SCHEDULES');
  const listIds = [];
  for (let ids of Array.from(configSchedules)) {
    listIds.push(ids['SCHEDULE']);
  }
  const configSchedulesIds =  _.uniq(_.flatten(listIds));
  debug("Schedules Ids from config: ", configSchedulesIds);
  return getSchedulesIds(function(err, schedulesIds) {
    if (err) { return cb(err); }
    debug('intersection: ', _.intersection(configSchedulesIds, schedulesIds).length);
    debug('config: ', configSchedulesIds.length);
    if ((_.intersection(configSchedulesIds, schedulesIds).length) === configSchedulesIds.length) {
      return cb(null, true);
    } else {
      return cb(null, false);
    }
  });
};

const processSchedulesFromConfig = function(done) {
  let messages = [];
  const configSchedules = nconf.get('SCHEDULES');
  debug('configSchedules:', configSchedules.length);
  return async.forEach(configSchedules, function(processedConfig, cb) {
    debug('Process schedule:' );
    return async.mapSeries(processedConfig['SCHEDULE'], (i, next) => getSchedule(i, next)
    , function(err, results) {
      if (err) { return cb(err); }
      if (results) {
        return processSchedules(results, processedConfig['EXCLUSION_DAYS'], function(err, message) {
          debug('processSchedules:', processedConfig);
          if (message !== "OK") {
            messages = messages.concat(message);
            if (processedConfig['NOTIFICATIONS']) {
              debug('Sending notifications.');
              return sendNotification(processedConfig['NOTIFICATIONS'], message, cb);
            }
          }
          return cb();
        });
      } else {
        return cb(new Error("No schedule to process."));
      }
    });
  }
  , function(err) {
    if (err) { return done(err); }
    return done(null, messages);
  });
};

var sendNotification = function(options, message, cb) {
  debug("NOTIFICATIONS:", message);
  debug("NOTIFICATIONS-OPTIONS:", options);
  return notify.send(options, message, err => cb(err));
};

var processSchedules = function(allSchedules, days, cb) {
  if (days == null) { days = []; }
  if (typeof days === 'function') {
    [cb, days] = Array.from([days, []]);
  }
  const messages = [];
  const duplicities = {};
  debug('allSchedules:', allSchedules);
  for (let schedule of Array.from(allSchedules)) {
    debug('schedule:', JSON.stringify(schedule));
    const otherSchedules = _.without(allSchedules, schedule);
    debug('otherSchedules:',JSON.stringify(otherSchedules));
    for (let entry of Array.from(schedule.entries)) {
      debug('checking entry: ', JSON.stringify(entry));
      const myStart = entry.start;
      const myEnd = entry.end;
      const myUserId = entry.user.id;
      const myUserName = entry.user.summary;
      if (duplicities.myUserName == null) { duplicities.myUserName = []; }
      for (let crossSchedule of Array.from(otherSchedules)) {
        for (let crossCheckEntry of Array.from(crossSchedule.entries)) {
          let overlap = false;
          const startDate = new Date(myStart);
          const day = getDayAbbrev(startDate.getUTCDay());

          const scheduleId = nconf.get(`schedulesNames:${schedule.id}`);
          const crossScheduleId = nconf.get(`schedulesNames:${crossSchedule.id}`);

          const message = {user: myUserName, userId: myUserId, schedules: [scheduleId, crossScheduleId], date: startDate, crossDate: new Date(crossCheckEntry.start)};

          if ((myStart <= crossCheckEntry.start && crossCheckEntry.start < myEnd) &&
              (crossCheckEntry.user.id === myUserId)) {
            var needle;
            overlap = true;

            if ((needle = day, Array.from(Object.keys(days)).includes(needle))) {

              if (((days[day] != null ? days[day].start : undefined) != null) && ((days[day] != null ? days[day].end : undefined) != null)) {
                const exclusionStartTime = days[day].start.split(':');
                const exclusionEndTime = days[day].end.split(':');
                const exclusionStartDate = new Date(myStart);
                exclusionStartDate.setUTCHours(exclusionStartTime[0]);
                exclusionStartDate.setUTCMinutes(exclusionStartTime[1]);
                const exclusionEndDate = new Date(myStart);
                exclusionEndDate.setUTCHours(exclusionEndTime[0]);
                exclusionEndDate.setUTCMinutes(exclusionEndTime[1]);


                if (exclusionStartDate <= startDate && startDate < exclusionEndDate) {
                  debug('excluded:', message);
                  overlap = false;
                }
              } else {
                overlap = false;
              }
            }
          }

          if (overlap && !Array.from(duplicities.myUserName).includes(crossCheckEntry.start)) {
            duplicities.myUserName.push(crossCheckEntry.start);
            messages.push(message);
          }
        }
      }
    }
  }
  debug(_.uniq(messages));
  if (messages.length === 0) {
    return cb(null, "OK");
  } else {
    return cb(null, _.uniq(messages));
  }
};

var getDayAbbrev = function(utcDay) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return days[utcDay];
};

module.exports = {
  getSchedulesIds,
  checkSchedulesIds,
  processSchedules,
  processSchedulesFromConfig,
  sendNotification
};
