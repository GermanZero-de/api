/*eslint-env mocha*/

const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const request = require('supertest')
const should = require('should')
const worker = require('../src/worker')

const jsonContentType = 'application/json'
const noop = () => {}

function okResult(data) {
  const headers = {
    get(which) {
      return which === 'content-type' ? jsonContentType : undefined
    }
  }
  return {ok: true, status: 200, headers, json: () => data}
}

const logger = require('./MockLogger')

const fetch = require('./MockFetch')(logger, {
  '^POST https://civicrm/.*&entity=contact&action=get&email=johndoe%40example.com': okResult({values: {}}),
  '^POST https://civicrm/.*&entity=contact&action=create': okResult({values: {'4711': {id:'4711'}}}),
  '^POST https://civicrm/.*&entity=address&action=create': okResult({}),
  '^POST https://civicrm/.*&entity=contact&action=update&id=4711': okResult({values: [{id: 4711, email: 'johndoe@example.com'}]}),
  '^PUT https://key.api.mailchimp.com/3.0/lists/mc-list/members/': okResult({}),
  'https://key.api.mailchimp.com/3.0/lists/mc-list/segments': okResult({segments: []})
})

const mailSender = {
  send(to, subject, template, data) {
    logger.debug({mail: {to, subject, template, data}})
  }
}

const config = require('./testConfig')
const EventStore = require('../src/EventStore')
const ModelsFactory = require('../src/readModels')
const adapters = require('../src/adapters')(fetch, config)
let app
let models
let controller
let store

function getFromLog(type, key) {
  return logger.log.filter(entry => entry[type] && entry[type][key]).map(entry => entry[type][key])
}

describe('RoutingTest', () => {
  beforeEach(() => {
    logger.reset()
    fs.unlinkSync(path.resolve(__dirname, 'events-0.json'))
    store = new EventStore({basePath: __dirname, logger})
    models = ModelsFactory({store, config})
    controller = require('../src/controller/ContactController')(store, models, adapters, mailSender, config)
        
    const mainRouter = require('../src/MainRouter')(adapters, controller, {bearerAuth: () => {}}, logger)
    app = express()
    app.use(bodyParser.urlencoded({extended: false}))
    app.use(bodyParser.json())
    app.use(mainRouter)
    app.use((error, req, res, next) => {
      res.status(error.status || 500).json({error})
      logger.debug({type: 'express', error, path: req.method + ' ' + req.path})
      next()
    })        
  })

  describe('GET /', () => {
    it('should redirect to /api-ui', async () => {
      const res = await request(app).get('/')
      should(res.status).equal(302)
      res.headers.location.should.equal('api-ui')
    })
  })
  
  describe('POST /subscriptions', () => {
    const testUser = {
      email: 'johndoe@example.com',
      postalCode: 10000
    }

    async function addTestUser() {
      await request(app).post('/subscriptions')
        .set('cotent-type', 'application/json')
        .send(testUser)
      await worker(models, controller, logger, {setTimeout: noop})
    }
        
    it('should create a contact in the CRM marked as "opt_out"', async () => {
      await addTestUser()
      const entry = getFromLog('debug', 'fetch').find(entry => entry.url.match(/^https:\/\/civicrm\//))
      entry.url.should.startWith('https://civicrm/sites/all/modules/civicrm/extern/rest.php')
      entry.url.should.match(/\bentity=contact\b/)
      entry.url.should.match(/\baction=create\b/)
      entry.url.should.match(/%22is_opt_out%22%3A%221%22/)
      entry.options.method.should.equal('POST')
    })
  
    it('should send a confirmation email', async () => {
      await addTestUser()
      const mail = getFromLog('debug', 'mail')[0]
      mail.should.containDeep({to: testUser.email, subject: 'GermanZero: Bestätigung', template: 'verificationMail'})
      mail.data.should.have.property('link')
      mail.data.should.have.property('contact')
    })
  })

  describe('/POST members', () => {
    const testUser = {
      email: 'johndoe@example.com',
      firstName: 'John',
      lastName: 'Doe',
    }

    async function addTestUser() {
      await request(app).post('/members')
        .set('cotent-type', 'application/json')
        .send(testUser)
      await worker(models, controller, logger, {setTimeout: noop})
    }
        
    it('should send a special confirmation mail for volunteers', async () => {
      await addTestUser()
      const mail = getFromLog('debug', 'mail')[0]
      mail.should.containDeep({to: testUser.email, subject: 'GermanZero: Bestätigung', template: 'verificationVolunteerMail'})
      mail.data.should.have.property('link')
      mail.data.should.have.property('contact')
    })
  })

  describe('GET /conctacts/:contactId/confirmations/:code', () => {
    const testUser = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'johndoe@example.com',
      postalCode: 10000,
      tags: ['Newsletter']
    }
        
    beforeEach(() => {
      store.add({type: 'contact-requested', contact: testUser})
      store.add({type: 'contact-created', contact: {id: '4711', ...testUser}})
    })

    it('should set the status of a contact to "opt_in"', async () => {
      await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960b')
      await worker(models, controller, logger, {setTimeout: noop})
      const entry = getFromLog('debug', 'fetch').find(entry => entry.url.match(/^https:\/\/civicrm\/.*entity=contact&action=update/))
      entry.url.should.match(/%22is_opt_out%22%3A%220%22/)
    })
  
    it('should send a welcome mail', async () => {
      await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960b')
      await worker(models, controller, logger, {setTimeout: noop})
      const mail = getFromLog('debug', 'mail')[0]
      mail.should.containDeep({to: testUser.email, subject: 'GermanZero: E-Mail Adresse ist bestätigt', template: 'welcomeMail'})
    })
  
    it('should redirect to confirmation ok page', async () => {
      const result = await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960b')
      result.header.location.should.deepEqual(config.baseUrl + '/contact-confirmed')
    })
  
    it('should reject invalid confirmation codes', async () => {
      const result = await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960c')
      result.header.location.should.deepEqual(config.baseUrl + '/invalid-confirmation')
    })

    it('should add new contacts to MailChimp', async () => {
      await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960b')
      await worker(models, controller, logger, {setTimeout: noop})
      const entries = getFromLog('debug', 'fetch').filter(entry => entry.url.match(/mailchimp.*lists\/mc-list\/members/))
      entries.length.should.equal(1)
      entries[0].url.should.match(/\/fd876f8cd6a58277fc664d47ea10ad19$/)
      entries[0].options.should.containDeep({method: 'put', body: JSON.stringify({email_address: 'johndoe@example.com', merge_fields: {FNAME: 'John', LNAME: 'Doe'}, status: 'subscribed'})})
    })

    it('should add tags when adding contacts to MailChimp', async () => {
      await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960b')
      await worker(models, controller, logger, {setTimeout: noop})
      const entries = getFromLog('debug', 'fetch').filter(entry => entry.url.match(/mailchimp.*lists\/mc-list\/segments/) && entry.options.method === 'POST')
      entries.length.should.equal(1)
      entries[0].options.body.should.equal(JSON.stringify({name: 'Newsletter', static_segment: ['johndoe@example.com']}))
    })
  })
})
