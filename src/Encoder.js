const crypto = require('crypto')
const algo = 'aes-256-cbc'

module.exports = (config) => {
  return {
    encrypt(text) {
      const cipher = crypto.createCipheriv(algo, config.key, config.iv)
      return Buffer.concat([cipher.update(text), cipher.final()]).toString('hex')
     },
     
     decrypt(text) {
      const encryptedText = Buffer.from(text, 'hex')
      const decipher = crypto.createDecipheriv(algo, config.key, config.iv)
      return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString()
     },

     createKeys() {
       return {
          key: crypto.randomBytes(32).toString('hex'),
          iv: crypto.randomBytes(16).toString('hex')
        }
     }
  }
}
