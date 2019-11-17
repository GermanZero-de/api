/*eslint-env mocha*/

const request = require('supertest')
const Server = require('../src/Server')
const should = require('should')

const jsonContentType = 'application/json'

function okResult(data) {
  return {ok: true, status: 200, headers: {'content-type': jsonContentType}, json: () => data}
}

const crmUrl = 'https://civicrm/sites/all/modules/civicrm/extern/rest.php'
function crmCmd(action, entity, json, additional) {
  return `POST ${crmUrl}?key=site-key&api_key=api-key&json=${encodeURIComponent(JSON.stringify(json))}&entity=${entity}&action=${action}${additional ? '&' + additional : ''}`
}

const expectedFetchResults = {
  'POST https://rocket.chat/api/v1/users.create': okResult({success: true}),
  'POST https://rocket.chat/api/v1/login': okResult({status: 'success', data: {}}),
  'POST https://rocket.chat/api/v1/logout': okResult({}),
  'POST https://wekan/users/login': okResult({}),
  'POST https://wekan/api/users': okResult({}),
  [crmCmd('create', 'contact', {contact_type: 'Individual', firstName: 'John', lastName: 'Doe', email: 'johndoe@example.com', is_opt_out: '1'})]: okResult({values: {'4711': {id:'4711'}}}),
  [crmCmd('get', 'contact', 1, 'email=johndoe%40example.com')]: okResult({values: {}}),
  [crmCmd('update', 'contact', {is_opt_out: '0'}, 'id=4711')]: okResult({values: {}})
}

const log = []
const addToLog = (msg) => log.push({type: 'log', msg})
const logger = {
  info(msg) {addToLog('INFO: ' + msg)},
  warn(msg) {addToLog('WARN: ' + msg)},
  error(msg) {addToLog('ERROR: ' + msg)},
  debug(msg) {addToLog('DEBUG: ' + msg)},
  logExpressRequests: () => {},
  logExpressErrors: (app) => app.use((err, req, res, next) => {
    log.push({type: 'express', msg: 'ERROR: ' + err.toString()})
    next()
  })
}

const fetch = async (url, options) => {
  log.push({type: 'fetch', url, options})
  const path = (options.method || 'GET').toUpperCase() + ' ' + url
  return expectedFetchResults[path] || { status: 404 }
}

const testUser = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'johndoe@example.com'
}

const config = require('./testConfig')
const app = Server(logger, fetch, config)

describe('GET /', () => {
  it('should redirect to /api-ui', async () => {
    const res = await request(app).get('/')
    should(res.status).equal(302)
    res.headers.location.should.equal('api-ui')
  })
})

describe('POST /contacts', () => {
  beforeEach(() => log.length = 0)

  it('should create a contact in the CRM marked as "opt_out"', async () => {
    await request(app).post('/contacts')
      .set('cotent-type', 'application/json')
      .send(testUser)
    const index = log.findIndex(entry => entry.type === 'fetch' && entry.url.match(/^https:\/\/civicrm\/.*entity=contact&action=create/))
    log[index].url.should.startWith(crmUrl)
    log[index].url.should.match(/%22is_opt_out%22%3A%221%22/)
    log[index].options.method.should.equal('POST')
  })

  it('should send a confirmation email', async () => {
    await request(app).post('/contacts')
      .set('cotent-type', 'application/json')
      .send(testUser)
    const index = log.findIndex(entry => entry.type === 'log' && entry.msg === `DEBUG: Sending email from test@example.com to johndoe@example.com with subject 'GermanZero: Bestätigung'`)
    index.should.be.greaterThanOrEqual(0)
  })
})

describe('GET /conctacts/:contactId/confirmations/:code', () => {
  beforeEach(() => log.length = 0)

  it('should set the status of a contact to "opt_in"', async () => {
    await request(app).get('/contacts/4711/confirmations/27c8ebd3ac585b50097ffa3c9457960b')
    const index = log.findIndex(entry => entry.type === 'fetch' && entry.url.match(/^https:\/\/civicrm\/.*entity=contact&action=update/))
    log[index].url.should.match(/%22is_opt_out%22%3A%220%22/)
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

describe('POST /members', () => {
  beforeEach(() => log.length = 0)

  const testUser = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'johndoe@example.com',
    password: 'my-great-secret'
  }

  it('should create a user in Rocket.Chat', async () => {
    await request(app).post('/members')
      .set('cotent-type', 'application/json')
      .send(testUser)
    const index = log.findIndex(entry => entry.type === 'fetch' && entry.url.match(/^https:\/\/rocket.chat\//))
    log[index].url.should.equal('https://rocket.chat/api/v1/login')
    log[index].options.method.should.equal('POST')
    log[index + 1].url.should.equal('https://rocket.chat/api/v1/users.create')
    log[index + 1].options.method.should.equal('POST')
    const body = JSON.parse(log[index + 1].options.body)
    body.name.should.equal(`${testUser.firstName} ${testUser.lastName}`)
    body.email.should.equal(testUser.email)
    body.password.should.equal(testUser.password)
  })

  it('should create a user in Wekan', async () => {
    await request(app).post('/members')
      .set('cotent-type', 'application/json')
      .send(testUser)
    const index = log.findIndex(entry => entry.type === 'fetch' && entry.url.match(/^https:\/\/wekan\//))
    log[index].url.should.equal('https://wekan/users/login')
    log[index].options.method.should.equal('POST')
    log[index + 1].url.should.equal('https://wekan/api/users')
    log[index + 1].options.method.should.equal('POST')
    const body = JSON.parse(log[index + 1].options.body)
    body.username.should.equal(`${testUser.firstName}.${testUser.lastName}`)
    body.email.should.equal(testUser.email)
    body.password.should.equal(testUser.password)
  })
})
