const Redirection = require('../Redirection')

module.exports = (store, models, CiviCRMAdapter, MailSender, config) => {
  const {encrypt, decrypt} = require('../Encoder')(config)

  function verifyCode(id, code) {
    try {
      return decrypt(code) === id
    } catch(error) {
      return false
    }
  }

  function assert(condition, message) {
    if (!condition) {
      throw {httpStatus: 400, message}
    }
  }

  return {
    registerContact(contact) {
      assert(contact.email && contact.email.match(/.+@.+\.\w+/), `email field doesn't look like an email`)
      assert(contact.firstName, `Field 'firstName' is required`)
      assert(contact.lastName, `Field 'lastName' is required`)
      if (models.contacts.getByEmail(contact.email)) {
        throw {httpStatus: 409, message: 'A contact with this email address already exists'}
      }
      store.add({type: 'contact-requested', contact})
      return {httpStatus: 202}
    },

    async doContactRegistration(data) {
      try {
      const contact = await CiviCRMAdapter.createContact({...data, is_opt_out: '1'})
      const code = encrypt(contact.id)
      const link = config.baseUrl + `/contacts/${contact.id}/confirmations/${code}`
      await MailSender.send(data.email, 'GermanZero: Bestätigung', 'verificationMail', {link, contact})
      store.add({type: 'contact-created', contact: {...data, id: contact.id}, code})
      } catch (error) {
        throw {httpStatus: 500, message: '' + error}
      }
    },
    
    confirmRegistration(id, code) {
      if (verifyCode(id, code)) {
        store.add({type: 'confirmation-requested', contactId: id, code})
        throw new Redirection(config.baseUrl + '/contact-confirmed')
      } else {
        throw new Redirection(config.baseUrl + '/invalid-confirmation')
      }
    },

    async doConfirmRegistration(contactId) {
      try {
        const contact = await CiviCRMAdapter.updateContact(+contactId, {is_opt_out: '0'})
        const model = models.contacts.getById(contactId)
        await MailSender.send(model.email, 'GermanZero: E-Mail Adresse ist bestätigt', 'welcomeMail', contact)
        store.add({type: 'confirmation-completed', contactId})
      } catch (error) {
        throw {httpStatus: 500, message: '' + error}
      }
    }
  }
}
