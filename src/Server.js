const express = require('express')
const bodyParser = require('body-parser')

module.exports = (Logger, fetch, config) => {
  const mainRouter = require('./MainRouter')(fetch, config)
  const app = express()

  if (!config.isProduction) {
    app.set('json spaces', 2)
  }
  app.use(bodyParser.urlencoded({extended: false}))
  app.use(bodyParser.json())
  Logger.logExpressRequests(app)
  app.use('/', mainRouter)
  Logger.logExpressErrors(app)

  return app
}
