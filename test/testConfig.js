module.exports = {
  rocketChat: {
    url: 'https://rocket.chat',
    adminPwd: 'rc-admin-pwd'
  },
  wekan: {
    url: 'https://wekan',
    adminPwd: 'wekan-admin_pwd'
  },
  civicrm: {
    url: 'https://civicrm',
    sitekey: 'site-key',
    apikey: 'api-key'
  },
  mail: {
    smtpHost: 'smptHost',
    smtpPort: 465,
    user: 'smtpUser',
    pwd: 'smpt-pwd',
    from: 'test@example.com',
    preventSendingEMails: true
  },
  mailchimp: {
    apiKey: 'mc-key',
    listId: 'mc-list',
    webhookCode: 'secret-mc-code'
  },
  isProduction: false,
  nodeenv: 'test',
  baseUrl: 'https://test-server',
  apiUrl: 'https://api.test-server',
  key: '12345678901234567890123456789012',
  iv: '1234567890123456'
}
