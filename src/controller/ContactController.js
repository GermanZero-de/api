const Redirection = require('../Redirection')

module.exports = (CiviCRMAdapter, MailSender, config) => {
  const {encrypt, decrypt} = require('../Encoder')(config)

  function verifyCode(id, code) {
    try {
      return decrypt(code) === id
    } catch(error) {
      return false
    }
  }
  
  return {
    async registerContact(data) {
      const exists = await CiviCRMAdapter.getContactByEMail(data.email)
      if (exists) {
        return {httpStatus: 409, message: 'A contact with this email address already exists'}
      }
      const contact = await CiviCRMAdapter.createContact({...data, is_opt_out: '1'})
      const id = Object.values(contact)[0].id
      const code = encrypt(id)
      const link = config.baseUrl + `/contacts/${id}/confirmations/${code}`

      await MailSender.send(data.email, 'GermanZero: Bestätigung', 'verificationMail', {link})
      return {httpStatus: 202}
    },
    
    async confirmRegistration(id, code) {
      if (verifyCode(id, code)) {
        await CiviCRMAdapter.updateContact(id, {is_opt_out: '0'})
        throw new Redirection(config.baseUrl + '/contact-confirmed')
      } else {
        throw new Redirection(config.baseUrl + '/invalid-confirmation')
      }
    }
  }
}
