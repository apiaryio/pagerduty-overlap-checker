fs    = require 'fs'
nconf = require 'nconf'

setupConfig = (configPath, cb) ->
  if fs.existsSync(configPath)
    console.log 'Loading config from :', configPath
    # Priority order argv before ENV and file as defaults
    nconf.argv()
      .env()
      .file({ file: configPath })
    process.env.DEBUG = nconf.get('DEBUG')
    cb()
  else
    cb new Error "Config does not exist: #{configPath}"

module.exports = {
  setupConfig
}
