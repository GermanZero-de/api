const {MESSAGE} = require('triple-beam')
const winston = require('winston')

const loggerOptions = {
  level: process.env.LOGLEVEL || 'info',
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format(info => {
      const rest = JSON.stringify(Object.assign({}, info, {
        level: undefined,
        message: undefined,
        timestamp: undefined
      }))

      info[MESSAGE] = `${info.timestamp} ${info.level.toUpperCase()}: ${info.message} ${rest !== '{}' ? rest : ''}`
      return info
    })()
  ),
  meta: false,
}

module.exports = {
  setupStandardLogger() {
    return winston.createLogger(loggerOptions)
  },

  attachToExpress(app, mainRouter) {
    const expressWinston = require('express-winston')
    const msg = `{{req.method}} {{req.url}} {{res.responseTime}}ms {{res.statusCode}} - {{req.headers['user-agent']}}`
    app.use(expressWinston.logger({...loggerOptions, msg}))
    app.use('/', mainRouter)
    app.use(expressWinston.errorLogger({...loggerOptions, meta: true}))
  }
}
