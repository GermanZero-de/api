require('dotenv').config()
const logger = require('./Logger')
const Server = require('./Server')
const fetch = require('node-fetch')
const config = require('./config')
const path = require('path')
const EventStore = require('./EventStore')
const worker = require('./worker')
let workerInstance

const store = new EventStore({basePath: path.resolve(__dirname, '..', 'store'), logger})
const models = require('./readModels')({store, config})
const adapters = require('./adapters')(fetch, config, logger)
const mailSender = require('./MailSender')(logger, config)
const controller = require('./controller/ContactController')(store, models, adapters, mailSender, config)
const auth = require('./auth')(fetch, logger)
const mainRouter = require('./MainRouter')(adapters, controller, auth, logger)

const app = Server(mainRouter, logger, config)
const server = app.listen(config.port, async () => {
  await models.isReady
  workerInstance = worker(models, controller, logger)
  logger.info(`Running on http://localhost:${config.port} in ${config.nodeenv} mode`)
})

process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received.')
  server.close(async () => {
    logger.info('http server closed')
    if (workerInstance) {
      (await workerInstance).close()
      logger.info('worker terminated')
    }
    store.end()
    logger.info('event stream ended')
    process.exit(0)
  })
})
