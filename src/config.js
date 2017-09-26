const fs = require('fs');
const nconf = require('nconf');

function setupConfig(configPath, cb) {
  if (fs.existsSync(configPath)) {
    console.log('Loading config from :', configPath);
    // Priority order argv before ENV and file as defaults
    nconf.argv()
      .env()
      .file({ file: configPath });
    process.env.DEBUG = nconf.get('DEBUG');
    return cb();
  }
  return cb(new Error(`Config does not exist: ${configPath}`));
}

module.exports = {
  setupConfig,
};
