fs    = require 'fs'
nconf = require 'nconf'
debug = require('debug')('pagerduty-overrides:config')

setupConfig = (configPath, cb) ->
  if fs.existsSync(configPath)
    debug('Loading config from :', configPath)
    # Priority order argv before ENV and file as defaults
    nconf.argv()
      .env()
      .file({ file: configPath })
    cb()
  else
    cb new Error "Config not exists: #{configPath}"

module.exports = {
  setupConfig
}
