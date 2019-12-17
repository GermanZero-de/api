module.exports = function () {
  const contacts = {
    byId: {},
    byEmail: {}
  }
  const requests = []

  return {
    dependencies: [],

    handleEvent(event, assert) {
      switch (event.type) {
        case 'contact-requested':
          assert(event.contact, 'No contact information in event')
          assert(event.contact.email, 'Missing email address')
          assert(!contacts.byEmail[event.contact.email], 'Contact already exists')
          contacts.byEmail[event.contact.email] = event.contact
          requests.push({type: 'create-contact', contact: event.contact})
          break

        case 'contact-created':
          assert(event.contact, 'No contact information in event')
          assert(event.contact.id, 'Missing id')
          assert(event.contact.email, 'Missing email address')
          assert(contacts.byEmail[event.contact.email], 'Unknown contact')
          contacts.byEmail[event.contact.email].id = event.contact.id
          contacts.byId[event.contact.id] = contacts.byEmail[event.contact.email]
          requests.splice(requests.findIndex(r => r.type === 'create-contact' && r.contact.email === event.contact.email), 1)
          break

        case 'confirmation-requested':
          assert(event.contactId, 'Missing contact id')
          assert(contacts.byId[event.contactId], 'Unknown contact')
          requests.push({type: 'confirm-contact', contactId: event.contactId})
          break

        case 'confirmation-completed':
          assert(event.contactId, 'Missing contact id attribute')
          assert(contacts.byId[event.contactId], 'Contact not found')
          requests.splice(requests.findIndex(r => r.contactId === event.contactId), 1)
          break

      }
    },

    getById(id) {
      return contacts.byId[id]
    },

    getByEmail(email) {
      return contacts.byEmail[email]
    },

    getFirstRequest() {
      return requests.find(request => !request.failing)
    },

    markRequestAsFailing(request) {
      request.failing = true
    }
  }
}
