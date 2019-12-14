require('dotenv').config()
const logger = require('./Logger')
const Server = require('./Server')
const fetch = require('node-fetch')
const config = require('./config')
const path = require('path')
const EventStore = require('./EventStore')
const worker = require('./worker')

const store = new EventStore({basePath: path.resolve(__dirname, '..', 'store'), logger})
const models = require('./readModels')({store, config})
const crmAdapter = require('./adapters/CiviCRMAdapter')(fetch, config)
const mailSender = require('./MailSender')(logger, config)
const controller = require('./controller/ContactController')(store, models, crmAdapter, mailSender, config)

worker(models, controller, logger)

const app = Server(store, models, logger, fetch, mailSender, config)
const server = app.listen(config.port, async () => {
  await models.isReady
  logger.info(`Running on http://localhost:${config.port} in ${config.nodeenv} mode`)
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received.')
  server.close(async () => {
    logger.info('http server closed')
    worker.close()
    logger.info('worker terminated')
    store.end()
    logger.info('event stream ended')
    process.exit(0)
  })
})
