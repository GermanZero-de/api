require('dotenv').config()
const Logger = require('./Logger')
const Server = require('./Server')
const fetch = require('node-fetch')
const config = require('./config')

const logger = Logger.setupStandardLogger()
const app = Server(Logger, fetch, config)
app.listen(config.port, () => {
  logger.info(`Running on http://localhost:${config.port} in ${config.nodeenv} mode`)
})
