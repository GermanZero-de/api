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

  async function listener(event) {
    let contact
    let diff
    let change
    switch(event.type) {
      case 'contact-requested':
        addToQueue(async () => {
          change = null
          if (!contacts[event.contact.email.toLowerCase()]) {
            logger.info(`Contact '${event.contact.email}' not yet in CRM`)
            change = event.contact
          } else {
            contact = contacts[event.contact.email.toLowerCase()]
            diff = Object.keys(contact).filter(key => !contact[key] && event.contact[key]).map(key => ({[key]: event.contact[key]}))
            if (diff.length) {
              change = Object.assign({id: contact.id}, ...diff)
              logger.info(`Contact '${event.contact.email}' gets new information ${JSON.stringify(change)}`)
            }
          }
          if (change) {
            contacts[event.contact.email.toLowerCase()] = await CRM.createContact(change) //eslint-disable-line
          }
        })
        break
        
      case 'contact-created':
        break
            
      case 'confirmation-requested':
        break
                
      case 'confirmation-completed':
        break
  
      case 'contact-unsubscribe':
        break
  
      default:
        throw `Unknown event '${event.type}'`
                    
    }
  }  
})()
