/* eslint-env node, mocha */

require('should')
const fs = require('fs')
const path = require('path')
const logger = require('./MockLogger')
const config = require('./testConfig')
const EventStore = require('../src/EventStore')
const ModelsFactory = require('../src/readModels')
const fetch = require('./MockFetch')(logger, {
  'POST https://civicrm/sites/all/modules/civicrm/extern/rest.php': {ok: true, json: () => ({values: [{}]})}
})
const mailSender = require('./MockMailSender')(logger)
const adapters = require('../src/adapters')(fetch, config)

const testContact = {
  email: 'janedoe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  postalCode: '10000'
}

const obligatoryFields = {
  subscription: ['email', 'postalCode'],
  member: ['email', 'firstName', 'lastName']
}

describe('ContactController', () => {
  let controller
  let store
  let models

  beforeEach(() => {
    logger.reset()
    fs.writeFileSync(path.resolve(__dirname, 'events-0.json'), '')
    store = new EventStore({basePath: __dirname, logger})
    models = ModelsFactory({store, config})
    controller = require('../src/controller/ContactController')(store, models, adapters.CiviCRMAdapter, mailSender, config)
  })

  describe('createContact', () => {
    Object.keys(obligatoryFields).forEach(type => {
      obligatoryFields[type].forEach(key => {
        it(`should moan if '${key}' is invalid in a ${type}`, () => {
          const contact = JSON.parse(JSON.stringify(testContact))
          delete contact[key]
          const msg = key === 'email' ? `email field doesn't look like an email` : `Field '${key}' is required`
          ;(() => controller.registerContact(contact, type === 'member')).should.throw(msg)
        })
      })
    })
  })

  describe('mailchimp-webhook', () => {
    it('should reject accesses with wrong code', async () => {
      const result = await controller.mailChimpWebhook('wrong-code', {})
      result.should.deepEqual({httpStatus: 403, message: 'Invalid code'})
    })

    it('should ignore non-unsubscribe events', async () => {
      const result = await controller.mailChimpWebhook('secret-mc-code', {type: 'subscribe'})
      result.should.deepEqual({})
    })

    it('should reject unsubscribes for unknown contacts', async () => {
      const result = await controller.mailChimpWebhook('secret-mc-code', {type: 'unsubscribe', 'data[email]': 'john@example.com'})
      result.should.deepEqual({httpStatus: 404, message: 'Unknown contact'})
    })

    it('should set opt-out when unsubscribe event arrives', async () => {
      await store.add({type: 'contact-requested', contact: testContact})
      await store.add({type: 'contact-created', contact: {id: '4711', ...testContact}})
      await controller.mailChimpWebhook('secret-mc-code', {
        type: 'unsubscribe',
        'data[email]': 'janedoe@example.com'
      })
      logger.log[0].debug.fetch.url.should.match(/%7B%22is_opt_out%22%3A%221%22%7D&entity=contact&action=update&id=4711/)
    })
  })
})
