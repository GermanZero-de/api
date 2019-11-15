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
  isProduction: process.env.NODE_ENV === 'production',
  nodeenv: process.env.NODE_ENV || 'develop',
  port: process.env.PORT || 3000
}

module.exports = config
