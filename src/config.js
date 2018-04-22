const fs = require('fs');
const nconf = require('nconf');
const momentTimezone = require("moment-timezone");
const momentRange = require("moment-range");
const moment = momentRange.extendMoment(momentTimezone);

function setupConfig(configPath, cb) {
  if (fs.existsSync(configPath)) {
    console.log('Loading config from :', configPath);
    // Priority order argv before ENV and file as defaults
    nconf.argv()
      .env()
      .file({ file: configPath });
    process.env.DEBUG = nconf.get('DEBUG');
    let timeSince;
    const timezone = "CET";
    if (nconf.get("TIME_SINCE")) {
      timeSince = moment.tz(nconf.get("TIME_SINCE"), timezone);
    }
    else {
      timeSince = moment.tz(timezone);
    }
    const weeksToCheck = nconf.get("WEEKS_TO_CHECK") || 2;
    nconf.set("TIME_SINCE", timeSince);
    nconf.set("TIME_UNTIL", moment.tz(timeSince, timezone).add(weeksToCheck, 'week'));
    nconf.set("TIMEZONE", timezone);

    return cb();
  }
  return cb(new Error(`Config does not exist: ${configPath}`));
}

module.exports = {
  setupConfig,
  moment
};
