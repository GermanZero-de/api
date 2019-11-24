/* eslint-env node, mocha */

const should = require('should')
const fs = require('fs')
const path = require('path')
const logger = require('./MockLogger')
const config = require('./testConfig')
const EventStore = require('../src/EventStore')
const ModelsFactory = require('../src/readModels')
const fetch = require('./MockFetch')(logger, {})
const mailSender = require('./MockMailSender')(logger)
const adapters = require('../src/adapters')(fetch, config)

const testContact = {
  email: 'janedoe@example.com',
  firstName: 'Jane',
  lastName: 'Doe'
}

describe('ContactController', () => {
  let controller
  let store
  let models

  before(() => {
    logger.reset()
    fs.unlinkSync(path.resolve(__dirname, 'events-0.json'))
    store = new EventStore({basePath: __dirname, logger})
    models = ModelsFactory({store, config})
    controller = require('../src/controller/ContactController')(store, models, adapters.CiviCRMAdapter, mailSender, config)
  })

  describe('createContact', () => {
    Object.keys(testContact).forEach(key => {
      it(`should moan if '${key}' is invalid`, () => {
        const contact = JSON.parse(JSON.stringify(testContact))
        delete contact[key]
        const msg = key === 'email' ? `email field doesn't look like an email` : `Field '${key}' is required`
        should(() => controller.registerContact(contact)).throw(msg)
      })
    })
  })
})
