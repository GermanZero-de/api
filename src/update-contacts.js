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
  const contacts = Object.assign({}, ...(await CRM.getAllContacts()).map(contact => ({[contact.email]: contact})))
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

  async function listener(event) {
    let contact
    let diff
    let change
    switch(event.type) {
      case 'contact-requested':
        addToQueue(async () => {
          if (event.contact.streetAddress && event.contact.houseNumber) {
            event.contact.streetAddress += ' ' + event.contact.houseNumber
            delete event.contact.houseNumber
          }
          change = null
          const email = event.contact.email.toLowerCase()
          contact = contacts[email]
          if (!contact) {
            logger.info(`Contact '${email}' not yet in CRM`)
            change = event.contact
          } else {
            diff = Object.keys(contact)
              .filter(byChangedField(event.contact, contact))
              .map(key => ({[key]: event.contact[key]}))
            if (diff.length) {
              change = Object.assign({id: contact.id}, ...diff)
              logger.info(`Contact '${email}' gets new information ${JSON.stringify(change)}`)
            }
          }
          if (change) {
            try {
              contacts[email] = await CRM.upsertContact(change, contact) //eslint-disable-line
            } catch (error) {
              logger.error(error)
            }
          }
        })
        break
        
      case 'contact-created':
        break
            
      case 'confirmation-requested':
        break
                
      case 'confirmation-completed':
        addToQueue(async () => {
          logger.info(`User ${event.contactId} opted in`)
          await CRM.upsertContact({id: event.contactId, is_opt_out: '0'})
        })
        break
  
      case 'contact-unsubscribe':
        addToQueue(async () => {
          logger.info(`User ${event.contactId} opted out`)
          await CRM.upsertContact({id: event.contactId, is_opt_out: '1'})
        })
        break
  
      default:
        throw `Unknown event '${event.type}'`
                    
    }
  }  
})()
