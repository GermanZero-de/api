const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

module.exports = (mainRouter, logger, config) => {
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
