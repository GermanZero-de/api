const Logger = require('./Logger')
const Server = require('./Server')

const nodeenv = process.env.NODE_ENV || 'develop'
const isProduction = nodeenv === 'production'
const port = process.env.PORT || 3000

const logger = Logger.setupStandardLogger()
const app = Server(isProduction, Logger)
app.listen(port, () => {
  logger.info(`Running on http://localhost:${port} in ${nodeenv} mode`)
})
