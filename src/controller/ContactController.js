const Redirection = require('../Redirection')
const {getKnownGenders, getKnownTitles} = require('../mapper/CrmMapper')

module.exports = (store, models, adapters, MailSender, config) => {
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

  async function doUnsubscribe(contact) {
    store.add({type: 'contact-unsubscribe', contactId: +contact.id, contact})
    await adapters.CiviCRMAdapter.updateContact(+contact.id, {is_opt_out: '1'})
  }

  return {
    registerForNewsletter(contact) {
      assert(contact.email && contact.email.match(/.+@.+\.\w+/), `email field doesn't look like an email`)
      assert(contact.postalCode, `Field 'postalCode' is required`)
      if (models.contacts.getByEmail(contact.email)) {
        throw {httpStatus: 409, message: 'A contact with this email address already exists'}
      }
      store.add({type: 'contact-requested', contact: {email: contact.email, postalCode: contact.postalCode, tags: ['Newsletter']}})
      return {httpStatus: 202}
    },

    registerAsVolunteer(contact) {
      assert(contact.email && contact.email.match(/.+@.+\.\w+/), `email field doesn't look like an email`)
      assert(contact.firstName, `Field 'firstName' is required`)
      assert(contact.lastName, `Field 'lastName' is required`)
      assert(!contact.gender || getKnownGenders().includes(contact.gender), `Field 'gender' contains an invalid value`)
      assert(!contact.title || getKnownTitles().includes(contact.title), `Field 'title' contains an invalid value`)
      contact.tags = ['Volunteer']
      if (contact.newsletter) {
        contact.tags.push('Newsletter')
      }
      store.add({type: 'contact-requested', contact})
      return {httpStatus: 202}
    },

    async doContactRegistration(data) {
      try {
        const contact = await adapters.CiviCRMAdapter.createContact({...data, is_opt_out: '1'})
        const code = encrypt('' + contact.id)
        const link = config.apiUrl + `/contacts/${contact.id}/confirmations/${code}`
        const template = data.tags && data.tags.includes('Volunteer') ? 'verificationVolunteerMail' : 'verificationMail'
        await MailSender.send(data.email, 'GermanZero: Bestätigung', template, {link, contact})
        store.add({type: 'contact-created', contact: {...data, id: contact.id}, code})
      } catch (error) {
        return {httpStatus: 500, message: '' + error, stack: error.stack}
      }
    },
    
    confirmRegistration(id, code) {
      if (verifyCode(id, code)) {
        store.add({type: 'confirmation-requested', contactId: id, code})
        return new Redirection(config.baseUrl + '/contact-confirmed')
      } else {
        return new Redirection(config.baseUrl + '/invalid-confirmation')
      }
    },

    async doConfirmRegistration(contactId) {
      try {
        const contact = models.contacts.getById(contactId)
        await adapters.CiviCRMAdapter.updateContact(+contactId, {is_opt_out: '0'})
        await adapters.MailChimpAdapter.addSubscriber(contact)
        if (contact.tags) {
          await adapters.MailChimpAdapter.addTags(contact, contact.tags)
        }
        const model = models.contacts.getById(contactId)
        const unsubscribe = config.apiUrl + `/contacts/${contact.id}/unsubscribe/${encrypt(model.id)}`
        await MailSender.send(model.email, 'GermanZero: E-Mail Adresse ist bestätigt', 'welcomeMail', {unsubscribe, contact})
        store.add({type: 'confirmation-completed', contactId})
      } catch (error) {
        return {httpStatus: 500, message: '' + error, stack: error.stack}
      }
    },

    async mailChimpWebhook(code, data) {
      if (code !== config.mailchimp.webhookCode) {
        return {httpStatus: 403, message: 'Invalid code'}
      }
      if (data.type !== 'unsubscribe') {
        return {}
      }
      const contact = models.contacts.getByEmail(data['data[email]'])
      if (!contact) {
        return {httpStatus: 404, message: 'Unknown contact'}
      }
      doUnsubscribe(contact)
      return {}
    },

    async unsubscribe(id, code) {
      if (verifyCode(id, code)) {
        const contact = models.contacts.getById(id)
        if (contact) {
          doUnsubscribe(contact)
          return new Redirection(config.baseUrl + '/unsubscribe-confirmed')
        }
      }
      return new Redirection(config.baseUrl + '/invalid-unsubscribe')
    }
  }
}
