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
  isProduction: process.env.NODE_ENV === 'production',
  nodeenv: process.env.NODE_ENV || 'develop',
  port: process.env.PORT || 3000
}

module.exports = config
