require('dotenv').config()
const logger = require('./Logger')
const Server = require('./Server')
const fetch = require('node-fetch')
const config = require('./config')

const app = Server(logger, fetch, config)
app.listen(config.port, () => {
  logger.info(`Running on http://localhost:${config.port} in ${config.nodeenv} mode`)
})
