/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const config   = require('./src/config');
const nconf    = require('nconf');
const pd       = require('./src/pagerduty');

const configPath = __dirname + '/config.json';

config.setupConfig(configPath, function(err) {
  if (err) { console.error(err); }
  return pd.checkSchedulesIds(function(err, res) {
    if (err) { console.error(err); }
    if (!res) {
      return console.error("Check failed");
    } else {
      return pd.processSchedulesFromConfig(function(err, msg) {
        if (err) {
          return console.error(err);
        } else {
          return console.log(msg);
        }
      });
    }
  });
});
