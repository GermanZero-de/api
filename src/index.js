const Logger = require('./Logger')
const Server = require('./Server')
const fetch = require('node-fetch')

const config = {
  rocketChat: {
    url: process.env.ROCKETCHAT_URL,
    adminUsername: 'admin',
    adminPwd: process.env.ROCKETCHAT_ADMINPWD
  },
  isProduction: process.env.NODE_ENV === 'production',
  nodeenv: process.env.NODE_ENV || 'develop',
  port: process.env.PORT || 3000
}

const logger = Logger.setupStandardLogger()
const app = Server(Logger, fetch, config)
app.listen(config.port, () => {
  logger.info(`Running on http://localhost:${config.port} in ${config.nodeenv} mode`)
})
