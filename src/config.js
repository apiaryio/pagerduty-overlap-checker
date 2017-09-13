/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs    = require('fs');
const nconf = require('nconf');

const setupConfig = function(configPath, cb) {
  if (fs.existsSync(configPath)) {
    console.log('Loading config from :', configPath);
    // Priority order argv before ENV and file as defaults
    nconf.argv()
      .env()
      .file({ file: configPath });
    process.env.DEBUG = nconf.get('DEBUG');
    return cb();
  } else {
    return cb(new Error(`Config does not exist: ${configPath}`));
  }
};

module.exports = {
  setupConfig
};
