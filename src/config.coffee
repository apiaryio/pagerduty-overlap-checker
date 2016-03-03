fs    = require 'fs'
nconf = require 'nconf'

setupConfig = ->
  # Priority order argv before ENV and file as defaults
  nconf.argv()
    .env()
    .file({ file: __dirname + '/../config.json' })

module.exports = {
  setupConfig
}
