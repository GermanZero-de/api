const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

module.exports = (store, models, logger, fetch, mailSender, config) => {
  const auth = require('./auth')(fetch, logger)
  const adapters = require('./adapters')(fetch, config)
  const controller = require('./controller/ContactController')(store, models, adapters.CiviCRMAdapter, adapters.MailChimpAdapter, mailSender, config)
  const mainRouter = require('./MainRouter')(adapters, controller, auth, logger)
  const app = express()

  //const origin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : undefined

  if (!config.isProduction) {
    app.set('json spaces', 2)
  }
  app.use(bodyParser.urlencoded({extended: false}))
  app.use(bodyParser.json())
  app.use(cors())
  logger.logExpressRequests(app)
  app.use('/', mainRouter)
  logger.logExpressErrors(app)

  return app
}
