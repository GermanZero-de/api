const nodemailer = require('nodemailer')
const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')

const mailTemplateDir = path.resolve(__dirname, 'mailTemplates')
const partialsDir = path.join(mailTemplateDir, 'partials')

module.exports = (config) => {
  const transporter = nodemailer.createTransport({
    host: config.mail.smtpHost,
    port: config.mail.smtpPort,
    auth: {
      user: config.mail.user,
      pass: config.mail.pwd
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
      return new Promise((resolve, reject) => {
        if (!config.mail.preventSendingEMails) {
          transporter.sendMail({from: config.mail.from, to, subject, html}, (err, info) => err ? reject(err) : resolve(info))
        } else {
          console.info(`Sending email from ${config.mail.from} to ${dest} with subject '${subject}'`)
          resolve({})
        }
      })
    }
  }
}
