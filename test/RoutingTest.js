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
  return {ok: true, status: 200, headers: {'content-type': jsonContentType}, json: () => data}
}

const logger = require('./MockLogger')

const fetch = require('./MockFetch')(logger, {
  '^POST https://civicrm/.*&entity=contact&action=get&email=johndoe%40example.com': okResult({values: {}}),
  '^POST https://civicrm/.*&entity=contact&action=create': okResult({values: {'4711': {id:'4711'}}}),
  '^POST https://civicrm/.*&entity=contact&action=update&id=4711': okResult({values: [{d: 4711, email: 'johndoe@example.com'}]})
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

describe('RoutingTest', () => {
  beforeEach(() => {
    logger.reset()
    fs.unlinkSync(path.resolve(__dirname, 'events-0.json'))
    store = new EventStore({basePath: __dirname, logger})
    models = ModelsFactory({store, config})
    controller = require('../src/controller/ContactController')(store, models, adapters.CiviCRMAdapter, mailSender, config)
        
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
        
    it('should create a contact in the CRM marked as "opt_out"', async () => {
      await request(app).post('/subscriptions')
        .set('cotent-type', 'application/json')
        .send(testUser)
      await worker(models, controller, logger, {setTimeout: noop})
      const entry = logger.log.find(entry => entry.debug && entry.debug.fetch && entry.debug.fetch.url.match(/^https:\/\/civicrm\/.*entity=contact&action=create/))
      entry.debug.fetch.url.should.startWith('https://civicrm/sites/all/modules/civicrm/extern/rest.php')
      entry.debug.fetch.url.should.match(/%22is_opt_out%22%3A%221%22/)
      entry.debug.fetch.options.method.should.equal('POST')
    })
  
    it('should send a confirmation email', async () => {
      await request(app).post('/subscriptions')
        .set('cotent-type', 'application/json')
        .send(testUser)
      await worker(models, controller, logger, {setTimeout: noop})
      const mail = logger.log.find(entry => entry.debug && entry.debug.mail)
      mail.debug.mail.should.containDeep({to: testUser.email, subject: 'GermanZero: Bestätigung', template: 'verificationMail'})
      mail.debug.mail.data.should.have.property('link')
      mail.debug.mail.data.should.have.property('contact')
    })
  })
  
  describe('GET /conctacts/:contactId/confirmations/:code', () => {
    const testUser = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'johndoe@example.com',
      postalCode: 10000
    }
        
    beforeEach(() => {
      store.add({type: 'contact-requested', contact: testUser})
      store.add({type: 'contact-created', contact: {id: '4711', ...testUser}})
    })

    it('should set the status of a contact to "opt_in"', async () => {
      await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960b')
      await worker(models, controller, logger, {setTimeout: noop})
      const entry = logger.log.find(entry => entry.debug && entry.debug.fetch && entry.debug.fetch.url.match(/^https:\/\/civicrm\/.*entity=contact&action=update/))
      entry.debug.fetch.url.should.match(/%22is_opt_out%22%3A%220%22/)
    })
  
    it('should send a welcome mail', async () => {
      await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960b')
      await worker(models, controller, logger, {setTimeout: noop})
      const mail = logger.log.find(entry => entry.debug && entry.debug.mail)
      mail.debug.mail.should.containDeep({to: testUser.email, subject: 'GermanZero: E-Mail Adresse ist bestätigt', template: 'welcomeMail'})
    })
  
    it('should redirect to confirmation ok page', async () => {
      const result = await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960b')
      result.header.location.should.deepEqual(config.baseUrl + '/contact-confirmed')
    })
  
    it('should reject invalid confirmation codes', async () => {
      const result = await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960c')
      result.header.location.should.deepEqual(config.baseUrl + '/invalid-confirmation')
    })
  })
})
