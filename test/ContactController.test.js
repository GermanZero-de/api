/* eslint-env node, mocha */

require('should')
const fs = require('fs')
const path = require('path')
const logger = require('./MockLogger')
const config = require('./testConfig')
const EventStore = require('../src/EventStore')
const ModelsFactory = require('../src/readModels')

const jsonContentType = 'application/json'

function okResult(data) {
  const headers = {
    get: which => which === 'content-type' ? jsonContentType : undefined
  }
  return {ok: true, status: 200, headers, json: () => data}
}
const fetch = require('./MockFetch')(logger, {
  'POST https://civicrm/sites/all/modules/civicrm/extern/rest.php': okResult({values: [{}]})
})
const mailSender = require('./MockMailSender')(logger)
const adapters = require('../src/adapters')(fetch, config)
const {encrypt} = require('../src/Encoder')(config)
const mapper = require('../src/mapper/CrmMapper')

const testContact = {
  email: 'janedoe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  postalCode: '10000',
  gender: 'female',
  title: 'Dr.'
}

describe('ContactController', () => {
  let controller
  let store
  let models
  let lastRegisteredContact

  beforeEach(() => {
    logger.reset()
    lastRegisteredContact = null
    fs.writeFileSync(path.resolve(__dirname, 'events-0.json'), '')
    store = new EventStore({basePath: __dirname, logger})
    models = ModelsFactory({store, config})
    controller = require('../src/controller/ContactController')(store, models, adapters, mailSender, config)
    store.listen((event) => {
      if (event.type === 'contact-requested') {
        lastRegisteredContact = event.contact
      }
    })
  })

  function assertFieldIsValid(field, func) {
    it(`should moan if '${field}' is invalid`, () => {
      const contact = JSON.parse(JSON.stringify(testContact))
      delete contact[field]
      const msg = field === 'email' ? `email field doesn't look like an email` : `Field '${field}' is required`
      ;(() => func(contact)).should.throw(msg)
    })
  }

  describe('registerForNewsletter', () => {
    ['email', 'postalCode'].forEach(field => assertFieldIsValid(field, contact => controller.registerForNewsletter(contact)))
  })

  describe('registerAsVolunteer', () => {
    ['email', 'firstName', 'lastName'].forEach(field => assertFieldIsValid(field, contact => controller.registerAsVolunteer(contact)))

    mapper.getKnownGenders().forEach(gender => {
      it(`should accept '${gender}' as gender`, async () => {
        await controller.registerAsVolunteer({...testContact, gender})
      })
    })

    mapper.getKnownTitles().forEach(title => {
      it(`should accept '${title}' as title`, async () => {
        await controller.registerAsVolunteer({...testContact, title})
      })
    })

    it('should map assist values with long key names to tags', async () => {
      await controller.registerAsVolunteer({...testContact, assists_finanzstark: 'finanzstark', assists_finanzkräftig: 'tatkräftig'})
      setImmediate(() => {
        lastRegisteredContact.should.have.property('tags')
        lastRegisteredContact.tags.should.containDeep(['finanzstark', 'tatkräftig'])
      })
    })

    it('should handle assists values as array correctly', async () => {
      await controller.registerAsVolunteer({...testContact, assists: ['finanzstark', 'tatkräftig']})
      setImmediate(() => {
        lastRegisteredContact.should.have.property('tags')
        lastRegisteredContact.tags.should.containDeep(['finanzstark', 'tatkräftig'])
      })
    })
    
    it('should handle sphere values as single values correctly', async () => {
      await controller.registerAsVolunteer({...testContact, sphere: 'it'})
      setImmediate(() => {
        lastRegisteredContact.should.have.property('tags')
        lastRegisteredContact.tags.should.containDeep(['it'])
      })
    })

    it('should handle sphere values as array correctly', async () => {
      await controller.registerAsVolunteer({...testContact, sphere: ['it', 'accounting']})
      setImmediate(() => {
        lastRegisteredContact.should.have.property('tags')
        lastRegisteredContact.tags.should.containDeep(['it', 'accounting'])
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
      const expected = 'json=' + encodeURIComponent(JSON.stringify({id: 4711, sequential: true, is_opt_out: '1'}))
      logger.log[0].debug.fetch.url.should.match(new RegExp(expected))
    })
  })

  describe('unsubscribe', () => {
    it('should reject accesses with wrong code', async () => {
      const result = await controller.unsubscribe('4711', 'wrong-code')
      result.should.have.property('redirect')
      result.redirect.should.equal('https://test-server/invalid-unsubscribe')
    })

    it('should reject unsubscribes for unknown contacts', async () => {
      const result = await controller.unsubscribe('4711', 'wrong-code')
      result.should.have.property('redirect')
      result.redirect.should.equal('https://test-server/invalid-unsubscribe')
    })

    async function unsubscribeWithValidCode() {
      await store.add({type: 'contact-requested', contact: testContact})
      await store.add({type: 'contact-created', contact: {id: '4711', ...testContact}})
      return controller.unsubscribe('4711', encrypt('4711'))
    }

    it('should set opt-out when unsubscribe is called', async () => {
      await unsubscribeWithValidCode()
      const expected = 'json=' + encodeURIComponent(JSON.stringify({id: 4711, sequential: true, is_opt_out: '1'}))
      logger.log[0].debug.fetch.url.should.match(new RegExp(expected))
    })

    it('should redirect if unsubscribe is called', async () => {
      const result = await unsubscribeWithValidCode()
      result.should.have.property('redirect')
      result.redirect.should.equal('https://test-server/unsubscribe-confirmed')
    })
  })
})
