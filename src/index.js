const express = require('express')
const app = express()
const Logger = require('./Logger')
const mainRouter = require('./MainRouter')

const nodeenv = process.env.NODE_ENV || 'develop'
const isProduction = nodeenv === 'production'
const port = process.env.PORT || 3000

const logger = Logger.setupStandardLogger()
if (!isProduction) {
  app.set('json spaces', 2)
}
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
Logger.attachToExpress(app, mainRouter)

const server = app.listen(port, () => {
  logger.info(`Running on http://localhost:${port} in ${nodeenv} mode`)
})
