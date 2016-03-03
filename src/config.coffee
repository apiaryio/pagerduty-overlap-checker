fs    = require 'fs'
nconf = require 'nconf'
debug = require('debug')('pagerduty-overrides:config')

setupConfig = (configPath) ->
  debug('Loading config from :', configPath)
  # Priority order argv before ENV and file as defaults
  nconf.argv()
    .env()
    .file({ file: configPath })

module.exports = {
  setupConfig
}
