require('dotenv').config()
const logger = require('./Logger')
const fetch = require('node-fetch')
const config = require('./config')
const path = require('path')
const EventStore = require('./EventStore')
const CRM = require('./adapters/CiviCRMAdapter')(fetch, config)

const store = new EventStore({basePath: path.resolve(__dirname, '..', 'store'), logger})

;(async function () {
  store.listen(listener)
  const allContacts = await CRM.getAllContacts()
  const contactsByEMail = Object.assign({}, ...allContacts.map(contact => ({[contact.email]: contact})))
  const contactsById = Object.assign({}, ...allContacts.map(contact => ({[contact.id]: contact})))
  const queue = {
    pending: [],
    running: null
  }
  await store.replay()

  function addToQueue(func) {
    const task = async function () {
      await func()
      queue.running = queue.pending.shift()
      if (queue.running) {
        queue.running()
      }
    }
    if (queue.running) {
      queue.pending.push(task)
    } else {
      (queue.running = task)()
    }
  }

  function byChangedField(event, contact) {
    return function (key) {
      if (event[key] === undefined) {
        return false
      }
      if (event[key] instanceof Array) {
        return event[key].length !== contact[key].length ||
          event[key].filter(x => contact[key].includes(x)).length !== event[key].length
      }
      return event[key] !== contact[key]
    }
  }

  async function upsertContact(contact) {
    let change = null

    if (contact.streetAddress && contact.houseNumber) {
      contact.streetAddress += ' ' + contact.houseNumber
      delete contact.houseNumber
    }
    const email = contact.email.toLowerCase()
    contact = contactsByEMail[email]
    if (!contact) {
      logger.info(`Contact '${email}' not yet in CRM`)
      change = contact
    } else {
      const diff = Object.keys(contact)
        .filter(byChangedField(contact, contact))
        .map(key => ({[key]: contact[key]}))
      if (diff.length) {
        change = Object.assign({id: contact.id}, ...diff)
        logger.info(`Contact '${email}' gets new information ${JSON.stringify(change)}`)
      }
    }
    if (change) {
      try {
        contactsByEMail[email] = await CRM.upsertContact(change, contact) //eslint-disable-line
      } catch (error) {
        logger.error(error)
      }
    }
  }

  async function setOptOutStatus(contactId, newStatus) {
    const contact = contactsById[contactId]
    if (!contact) {
      logger.error(`Contact ${contactId} not found`)
    } else if (contact.is_opt_out !== newStatus) {
      logger.info(`User ${contactId} opted in`)
      await CRM.upsertContact({id: contactId, is_opt_out: newStatus}, contact)
    }
  }

  async function listener(event) {
    switch(event.type) {
      case 'contact-requested':
        addToQueue(() => upsertContact(event.contact))
        break
        
      case 'contact-created':
        break
            
      case 'confirmation-requested':
        break
                
      case 'confirmation-completed':
        addToQueue(() => setOptOutStatus(event.contactId, '0'))
        break
  
      case 'contact-unsubscribe':
        addToQueue(() => setOptOutStatus(event.contactId, '1'))
        break
  
      default:
        throw `Unknown event '${event.type}'`
                    
    }
  }  
})()
