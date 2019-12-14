const nodemailer = require('nodemailer')
const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')

const mailTemplateDir = path.resolve(__dirname, 'mailTemplates')
const partialsDir = path.join(mailTemplateDir, 'partials')

module.exports = (logger, config) => {
  const transporter = nodemailer.createTransport({
    host: config.mail.smtpHost,
    port: config.mail.smtpPort,
    secure: false,
    requireTLS: true,
    auth: {
      user: config.mail.user,
      pass: config.mail.pwd,
    }
  })

  fs.readdirSync(partialsDir).forEach(partial => {
    Handlebars.registerPartial(partial.replace(/.html$/, ''), fs.readFileSync(path.join(partialsDir, partial)).toString())
  })

  return {
    send(dest, subject, templateName, data) {
      const template = Handlebars.compile(fs.readFileSync(path.join(mailTemplateDir, templateName + '.html')).toString())
      const html = template({config, ...data})
      const to = config.mail.redirect || dest
      logger.debug(`Sending email from ${config.mail.from} to ${dest} with subject '${subject}'`)
      if (!config.mail.preventSendingEMails) {
        return transporter.sendMail({from: config.mail.from, to, subject, html})
      }
    }
  }
}
