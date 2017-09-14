const config = require('./src/config');
const pd = require('./src/pagerduty');

const configPath = `${__dirname}/config.json`;

config.setupConfig(configPath, (configErr) => {
  if (configErr) { console.error(configErr); }
  return pd.checkSchedulesIds((checkSchedulesErr, res) => {
    if (checkSchedulesErr) { console.error(checkSchedulesErr); }
    if (!res) {
      return console.error('Check failed');
    }
    return pd.processSchedulesFromConfig((err, msg) => {
      if (err) {
        return console.error(err);
      }
      return console.log(msg);
    });
  });
});
