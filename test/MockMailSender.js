module.exports = (logger) => {
  return {
    send(to, subject, template, data) {
      logger.debug({mailer: {to, subject, template, data}})
    }
  }
}
