const async = require('async');
const moment = require('./config').moment;

const nconf = require('nconf');
const _ = require('lodash');
const debug = require('debug')('pagerduty-overrides:pagerduty');
const notify = require('./notify');
const pdApi = require('./pagerduty-api');

// Get schedule for ID and 2 weeks
function getSchedule(id, cb) {
  const timezone = nconf.get('TIMEZONE');
  const timeUntil = moment.tz(nconf.get('TIME_UNTIL'), timezone);
  const timeSince = moment.tz(nconf.get('TIME_SINCE'), timezone);

  const scheduleOpts = {
    qs: {
      'schedule_ids[]': id,
      until: timeUntil.toISOString(),
      since: timeSince.toISOString(),
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

function subtract(originalRange, rangesToSubtract) {
  let originalRangeArray;
  if (!Array.isArray(originalRange)) {
    originalRangeArray = [originalRange];
  } else {
    originalRangeArray = originalRange;
  }

  return _.flatten(originalRangeArray.map((orig) => {
    let remaining = [orig];
    _.flatten(rangesToSubtract).forEach((s) => {
      debug(`Processing: ${s}`);
      remaining = _.compact(remaining.map((r) => {
        debug(`Subtracting ${s} from ${r}`);
        const result = [];
        _.flatten(r.subtract(s)).forEach((newRange) => {
          // avoid ms-long durations
          if (newRange && (newRange.duration() > 1 || newRange.duration() < -1)) {
            debug(`Returning ${newRange}`);
            result.push(newRange);
          }
        });
        return result;
      }));
      remaining = _.flatten(remaining);
    });
    return _.compact(remaining);
  })
  );
}

function getExcludeRanges(excludeDays, timeSince, timeUntil, timezone) {
  let excludeDaysArray = [];
  if (!Array.isArray(excludeDays)) {
    Object.keys(excludeDays).forEach((key) => {
      const exclDay = { day: key };
      if (excludeDays[key].start) exclDay.start = excludeDays[key].start;
      if (excludeDays[key].end) exclDay.end = excludeDays[key].end;
      excludeDaysArray.push(exclDay);
    });
  } else {
    excludeDaysArray = excludeDays;
  }

  debug('Exclude days array: ', JSON.stringify(excludeDaysArray));

  const excludeRanges = [];
  const checkRange = moment.range(timeSince, timeUntil);
  debug('Checking range:', JSON.stringify(checkRange));
  excludeDaysArray.forEach((item) => {
    // generate all ranges based on the check interval, then compare them with found overlaps
    const daysToAdd = [];
    let tmp = moment.tz(timeSince, timezone).day(item.day).startOf('day');
    while (tmp.isBefore(timeUntil)) {
      daysToAdd.push(tmp);
      tmp = moment
        .tz(tmp, timezone)
        .add(1, 'week');
    }
    debug('Days to add: ', JSON.stringify(daysToAdd));
    daysToAdd.forEach((dayToAdd) => {
      let start = moment.tz(dayToAdd, timezone).startOf('day');
      let end = moment.tz(dayToAdd, timezone).startOf('day');
      if (item.start) {
        const startTime = item.start.split(':');
        // we can't call moment.add({hours:number}) as this would produce an off value for the DST switch day
        start = moment.tz(`${start.format('YYYY-MM-DD')} ${startTime[0]}:${startTime[1]}`, timezone)
      }
      if (item.end) {
        const endTime = item.end.split(':');
        // we can't call moment.add({hours:number}) as this would produce an off value for the DST switch day
        end = moment.tz(`${end.format('YYYY-MM-DD')} ${endTime[0]}:${endTime[1]}`, timezone)
      } else {
        end = end.endOf('day');
      }
      excludeRanges.push(moment.range(start, end));
    });
  });

  debug('Exclude ranges: ', JSON.stringify(excludeRanges));
  return excludeRanges;
}

function processSchedules(allSchedules, excludeDays = [], cb) {
  let callback = cb;
  let excludeDaysArray = excludeDays;

  if (typeof excludeDaysArray === 'function') {
    callback = excludeDaysArray;
    excludeDaysArray = [];
  }

  const timezone = nconf.get('TIMEZONE');
  const timeUntil = moment.tz(nconf.get('TIME_UNTIL'), timezone);
  const timeSince = moment.tz(nconf.get('TIME_SINCE'), timezone);

  const excludeRanges = getExcludeRanges(excludeDaysArray, timeSince, timeUntil, timezone);

  const messages = [];
  const duplicities = {};
  debug('allSchedules:', JSON.stringify(allSchedules));
  allSchedules.forEach((schedule) => {
    debug('schedule:', JSON.stringify(schedule));
    const otherSchedules = _.without(allSchedules, schedule);
    debug('otherSchedules:', JSON.stringify(otherSchedules));
    schedule.entries.forEach((entry) => {
      debug('checking entry: ', JSON.stringify(entry));
      const entryRange = moment.range(
        moment.tz(moment.max(entry.start, timeSince), timezone),
        moment.tz(moment.min(entry.end, timeUntil), timezone)
      );
      const entryUserName = entry.user.summary;
      if (duplicities[entryUserName] == null) duplicities[entryUserName] = [];
      otherSchedules.forEach((crossSchedule) => {
        crossSchedule.entries
          .filter(e => e.user.id === entry.user.id)
          .forEach((crossCheckEntry) => {
            const scheduleId = nconf.get(`schedulesNames:${schedule.id}`);
            const crossScheduleId = nconf.get(`schedulesNames:${crossSchedule.id}`);
            const crossCheckRange = moment.range(
              moment.tz(moment.max(crossCheckEntry.start, timeSince), timezone),
              moment.tz(moment.min(crossCheckEntry.end, timeUntil), timezone)
            );

            if (crossCheckRange.overlaps(entryRange)) {
              const overlapRange = crossCheckRange.intersect(entryRange);
              debug('Found overlap range:', JSON.stringify(overlapRange));
              debug('Excluded range:', JSON.stringify(excludeRanges));
              const remainingOverlapRanges = subtract(overlapRange, excludeRanges);
              debug('Overlap ranges after removal:', JSON.stringify(remainingOverlapRanges));
              if (!_.isEmpty(remainingOverlapRanges)) {
                remainingOverlapRanges.forEach((range) => {
                  const message = {
                    user: entryUserName,
                    userId: entry.user.id,
                    schedules: [scheduleId, crossScheduleId],
                    overlapStart: moment.tz(range.start, timezone),
                    overlapEnd: moment.tz(range.end, timezone),
                  };
                  if (!duplicities[entryUserName].includes(range.start.toISOString())) {
                    duplicities[entryUserName].push(range.start.toISOString());
                    messages.push(message);
                  }
                });
              }
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
  subtract,
};
