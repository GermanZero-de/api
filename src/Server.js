const express = require('express')
const bodyParser = require('body-parser')

module.exports = (logger, fetch, config) => {
  const mainRouter = require('./MainRouter')(logger, fetch, config)
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
