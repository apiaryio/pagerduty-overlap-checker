const async = require('async');
const moment = require('moment');
const nconf = require('nconf');
const _ = require('underscore');
const debug = require('debug')('pagerduty-overrides');
const notify = require('./notify');
const pdApi = require('./pagerduty-api');

// Get schedule for ID and 2 weeks
function getSchedule(id, cb) {
  if (nconf.get('WEEKS_TO_CHECK') > 0) {
    const timeUntil = moment.utc().add(nconf.get('WEEKS_TO_CHECK'), 'w');

    const scheduleOpts = {
      qs: {
        'schedule_ids[]': id,
        until: timeUntil.toISOString(),
        since: moment.utc().toISOString(),
      },
    };


    return pdApi.send('/oncalls', scheduleOpts, (err, res, body) => {
      if (err) {
        console.log('Request send error:', err);
        return cb(err);
      }

      if (res.statusCode !== 200) {
        return cb(new Error(`Entries returned status code ${res.statusCode}`));
      }
      return cb(err, { id, entries: body.oncalls });
    });
  }
  return cb(new Error('Missing WEEKS_TO_CHECK settings'));
}

// Get all schedules and returns their ids
function getSchedulesIds(cb) {
  debug('Getting schedules from PD');
  return pdApi.send('/schedules', {}, (err, res, body) => {
    if (err) {
      console.log('Request send error:', err);
      return cb(err);
    }

    debug('Returned status code:', res.statusCode);
    const schedulesIds = [];

    body.schedules.forEach((schedule) => {
      schedulesIds.push(schedule.id);
      // UWAGA UWAGA - side effect follows!
      // it's easier and more comprehensive to load schedule names here and store them using nconf
      nconf.set(`schedulesNames:${schedule.id}`, schedule.name);
    });

    debug('Schedules Ids from PD: ', schedulesIds);
    debug('Schedules Names from PD: ', nconf.get('schedulesNames'));
    return cb(null, schedulesIds);
  });
}

// Check if all schedules defined in config are available in PD
function checkSchedulesIds(cb) {
  const configSchedules = nconf.get('SCHEDULES');
  const listIds = [];
  configSchedules.forEach((ids) => {
    listIds.push(ids.SCHEDULE);
  });
  const configSchedulesIds = _.uniq(_.flatten(listIds));
  debug('Schedules Ids from config: ', configSchedulesIds);
  return getSchedulesIds((err, schedulesIds) => {
    if (err) { return cb(err); }
    debug('intersection: ', _.intersection(configSchedulesIds, schedulesIds).length);
    debug('config: ', configSchedulesIds.length);
    if ((_.intersection(configSchedulesIds, schedulesIds).length) === configSchedulesIds.length) {
      return cb(null, true);
    }
    return cb(null, false);
  });
}

function sendNotification(options, message, cb) {
  debug('NOTIFICATIONS:', message);
  debug('NOTIFICATIONS-OPTIONS:', options);
  return notify.send(options, message, err => cb(err));
}

function processSchedules(allSchedules, days = [], cb) {
  let callback = cb;
  let daysArray = days;

  if (typeof daysArray === 'function') {
    callback = daysArray;
    daysArray = [];
  }

  const messages = [];
  const duplicities = {};
  debug('allSchedules:', allSchedules);
  allSchedules.forEach((schedule) => {
    debug('schedule:', JSON.stringify(schedule));
    const otherSchedules = _.without(allSchedules, schedule);
    debug('otherSchedules:', JSON.stringify(otherSchedules));
    schedule.entries.forEach((entry) => {
      debug('checking entry: ', JSON.stringify(entry));
      const myStart = moment.utc(entry.start);
      const myEnd = moment.utc(entry.end);
      const myUserId = entry.user.id;
      const myUserName = entry.user.summary;
      if (duplicities.myUserName == null) { duplicities.myUserName = []; }
      otherSchedules.forEach((crossSchedule) => {
        crossSchedule.entries.forEach((crossCheckEntry) => {
          let overlap = false;

          const scheduleId = nconf.get(`schedulesNames:${schedule.id}`);
          const crossScheduleId = nconf.get(`schedulesNames:${crossSchedule.id}`);
          const crossCheckStart = moment.utc(crossCheckEntry.start);
          const crossCheckEnd = moment.utc(crossCheckEntry.end);
          let message;

          // is there an overlap?
          if ((crossCheckStart < myEnd && myStart < crossCheckEnd) &&
              (crossCheckEntry.user.id === myUserId)) {
            // find overlapping inteval
            const overlapStart = moment.max(myStart, crossCheckStart);
            const overlapEnd = moment.min(crossCheckEnd, myEnd);

            message = {
              user: myUserName,
              userId: myUserId,
              schedules: [scheduleId, crossScheduleId],
              overlapStart,
              overlapEnd,
            };

            [overlapStart, overlapEnd].forEach((day) => {
              overlap = true;
              const overlappingDay = day.format('ddd');

              if (Object.keys(daysArray).includes(overlappingDay)) {
                if (daysArray[overlappingDay].start && daysArray[overlappingDay].end) {
                  const exclusionStartTime = daysArray[overlappingDay].start.split(':');
                  const exclusionEndTime = daysArray[overlappingDay].end.split(':');
                  const exclusionStartDate = moment.utc(day);
                  exclusionStartDate.hours(exclusionStartTime[0]);
                  exclusionStartDate.minutes(exclusionStartTime[1]);
                  const exclusionEndDate = moment.utc(day);
                  exclusionEndDate.hours(exclusionEndTime[0]);
                  exclusionEndDate.minutes(exclusionEndTime[1]);

                  if (day.isBetween(exclusionStartDate, exclusionEndDate)) {
                    debug('excluded:', message);
                    overlap = false;
                  }
                } else {
                  overlap = false;
                }
              }
            });
          }

          if (overlap && !duplicities.myUserName.includes(crossCheckEntry.start)) {
            duplicities.myUserName.push(crossCheckEntry.start);
            messages.push(message);
          }
        });
      });
    });
  });
  debug(_.uniq(messages));
  if (messages.length === 0) {
    return callback(null, 'OK');
  }
  return callback(null, _.uniq(messages));
}

function processSchedulesFromConfig(done) {
  let messages = [];
  const configSchedules = nconf.get('SCHEDULES');
  debug('configSchedules:', configSchedules.length);
  return async.forEach(configSchedules, (processedConfig, cb) => {
    debug('Process schedule:');
    return async.mapSeries(processedConfig.SCHEDULE, (i, next) => getSchedule(i, next)
      , (mapErr, results) => {
        if (mapErr) { return cb(mapErr); }
        if (results) {
          return processSchedules(results, processedConfig.EXCLUSION_DAYS, (err, message) => {
            debug('processSchedules:', processedConfig);
            if (message !== 'OK') {
              messages = messages.concat(message);
              if (processedConfig.NOTIFICATIONS) {
                debug('Sending notifications.');
                return sendNotification(processedConfig.NOTIFICATIONS, message, cb);
              }
            }
            return cb();
          });
        }
        return cb(new Error('No schedule to process.'));
      });
  }
    , (err) => {
    if (err) { return done(err); }
    return done(null, messages);
  });
}

module.exports = {
  getSchedulesIds,
  checkSchedulesIds,
  processSchedules,
  processSchedulesFromConfig,
  sendNotification,
};
