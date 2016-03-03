fs    = require 'fs'
nconf = require 'nconf'

# Priority order argv before ENV and file as defaults
nconf.argv()
  .env()
  .file({ file: __dirname + '/../config.json' })
  
console.log 'NODE_ENV: ' + nconf.get 'NODE_ENV'
console.log 'PAGERDUTY_RO_TOKEN: ' + nconf.get 'PAGERDUTY_READ_ONLY_TOKEN'
console.log 'PAGERDUTY_TOKEN: ' + nconf.get 'PAGERDUTY_TOKEN'
