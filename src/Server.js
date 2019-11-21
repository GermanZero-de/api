const express = require('express')
const bodyParser = require('body-parser')

module.exports = (store, models, logger, fetch, config) => {
  const adapters = require('./adapters')(fetch, config)
  const mailSender = require('./MailSender')(logger, config)
  const controller = require('./controller/ContactController')(store, models, adapters.crm, mailSender, config)

  const mainRouter = require('./MainRouter')(adapters, controller)
  const app = express()

  if (!config.isProduction) {
    app.set('json spaces', 2)
  }
  app.use(bodyParser.urlencoded({extended: false}))
  app.use(bodyParser.json())
  logger.logExpressRequests(app)
  app.use('/', mainRouter)
  logger.logExpressErrors(app)

  return app
}
