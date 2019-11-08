const express = require('express')
const mainRouter = require('./MainRouter')
const bodyParser = require('body-parser')

module.exports = (isProduction, Logger) => {
  const app = express()

  if (!isProduction) {
    app.set('json spaces', 2)
  }
  app.use(bodyParser.urlencoded({extended: false}))
  app.use(bodyParser.json())
  Logger.logExpressRequests(app)
  app.use('/', mainRouter)
  Logger.logExpressErrors(app)

  return app
}
