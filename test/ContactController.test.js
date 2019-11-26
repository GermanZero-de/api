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
        ;(() => controller.registerContact(contact)).should.throw(msg)
      })
    })
  })

  describe('mailchimp-webhook', () => {
    it('should reject accesses with wrong code', async () => {
      controller.mailChimpWebhook('wrong-code', {}).should.be.rejectedWith('Invalid code')
    })

    it('should ignore non-unsubscribe events', async () => {
      const result = await controller.mailChimpWebhook('secret-mc-code', {type: 'subscribe'})
      result.should.deepEqual({})
    })

    it('should reject unsubscribes for unknown contacts', async () => {
      controller.mailChimpWebhook('secret-mc-code', {type: 'unsubscribe', 'data[email]': 'john@example.com'}).should.be.rejectedWith('Unknown contact')
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
