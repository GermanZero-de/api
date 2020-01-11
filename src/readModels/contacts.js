module.exports = function () {
  const contacts = {
    byId: {},
    byEmail: {}
  }
  const requests = []

  function unifyAssistsFields(contact) {
    if (!contact.tags) {
      contact.tags = []
    }
    Object.keys(contact)
    .filter(key => key.match(/^(assists|sphere)/))
    .forEach(key => {
      if (contact[key] instanceof Array) {
        contact.tags.push(...contact[key].map(t => t.toLowerCase()))
      } else {
        contact.tags.push(contact[key].toLowerCase())
      }
    })
    return contact
  }

  return {
    dependencies: [],

    handleEvent(event, assert) {
      function removeRequest(compare) {
        const index = requests.findIndex(compare)
        if (index >= 0) {
          requests.splice(index, 1)
        }
      }
    
      switch (event.type) {
        case 'contact-requested':
          assert(event.contact, 'No contact information in event')
          assert(event.contact.email, 'Missing email address')
          assert(!contacts.byEmail[event.contact.email], 'Contact already exists')
          unifyAssistsFields(event.contact)
          contacts.byEmail[event.contact.email] = event.contact
          requests.push({type: 'create-contact', contact: event.contact, ts: event.ts})
          break

        case 'contact-created':
          assert(event.contact, 'No contact information in event')
          assert(event.contact.id, 'Missing id')
          assert(event.contact.email, 'Missing email address')
          assert(contacts.byEmail[event.contact.email], 'Unknown contact')
          unifyAssistsFields(event.contact)
          contacts.byEmail[event.contact.email].id = event.contact.id
          contacts.byId[event.contact.id] = contacts.byEmail[event.contact.email]
          removeRequest(r => r.type === 'create-contact' && r.contact.email === event.contact.email)
          break

        case 'confirmation-requested':
          assert(event.contactId, 'Missing contact id')
          assert(contacts.byId[event.contactId], 'Unknown contact')
          removeRequest(r => r.type === 'confirm-contact' && r.contactId === event.contactId)
          requests.push({type: 'confirm-contact', contactId: event.contactId, ts: event.ts})
          break

        case 'confirmation-completed':
          assert(event.contactId, 'Missing contact id attribute')
          assert(contacts.byId[event.contactId], 'Contact not found')
          removeRequest(r => r.type === 'confirm-contact' && r.contactId === event.contactId)
          break
        
        case 'contact-unsubscribe':
          assert(event.contactId, 'Missing contact id attribute')
          removeRequest(r => r.contactId === event.contactId)
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
