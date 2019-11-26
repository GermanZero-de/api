const config = {
  rocketChat: {
    url: process.env.ROCKETCHAT_URL,
    adminUsername: 'admin',
    adminPwd: process.env.ROCKETCHAT_ADMINPWD
  },
  wekan: {
    url: process.env.WEKAN_URL,
    adminUsername: 'Admin',
    adminPwd: process.env.WEKAN_ADMINPWD
  },
  civicrm: {
    url: process.env.CIVICRM_URL,
    sitekey: process.env.CIVICRM_SITEKEY,
    apikey: process.env.CIVICRM_APIKEY
  },
  mail: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pwd: process.env.SMTP_PWD,
    from: 'GermanZero.de <germanzero@dilab.co>',
    redirect: process.env.MAIL_REDIRECT
  },
  mailchimp: {
    apiKey: process.env.MC_APIKEY,
    listId: process.env.MC_LISTID,
    webhookCode: process.env.MC_WEBHOOK_CODE
  },
  isProduction: process.env.NODE_ENV === 'production',
  nodeenv: process.env.NODE_ENV || 'develop',
  port: process.env.PORT || 3000,
  host: process.env.HOST,
  baseUrl: process.env.BASEURL,
  key: Buffer.from(process.env.KEY, 'hex'),
  iv: Buffer.from(process.env.IV, 'hex')
}

module.exports = config
