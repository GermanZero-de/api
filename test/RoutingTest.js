/*eslint-env mocha*/

const request = require('supertest')
const Server = require('../src/Server')
const should = require('should')

const jsonContentType = 'application/json'

function okResult(data) {
  return {ok: true, status: 200, headers: {'content-type': jsonContentType}, json: () => data}
}

const crmUrl = 'https://civicrm/sites/all/modules/civicrm/extern/rest.php'
function crmCmd(paramStr) {
  return `POST ${crmUrl}?key=site-key&api_key=api-key&${paramStr}`
}

const expectedFetchResults = {
  'POST https://rocket.chat/api/v1/users.create': okResult({success: true}),
  'POST https://rocket.chat/api/v1/login': okResult({status: 'success', data: {}}),
  'POST https://rocket.chat/api/v1/logout': okResult({}),
  'POST https://wekan/users/login': okResult({}),
  'POST https://wekan/api/users': okResult({}),
  [crmCmd('json=%7B%22contact_type%22%3A%22Individual%22%2C%22firstName%22%3A%22John%22%2C%22lastName%22%3A%22Doe%22%2C%22email%22%3A%22johndoe%40example.com%22%2C%22is_opt_out%22%3A%221%22%7D&entity=contact&action=create')]: okResult({values: {'4711': {id:'4711'}}}),
  [crmCmd('json=1&entity=contact&action=get&email=johndoe%40example.com')]: okResult({values: {}})
}

const log = []
const addToLog = (msg) => log.push({type: 'log', msg})
const logger = {
  info(msg) {addToLog('INFO: ' + msg)},
  warn(msg) {addToLog('WARN: ' + msg)},
  error(msg) {addToLog('ERROR: ' + msg)},
  debug(msg) {addToLog('DEBUG: ' + msg)},
  logExpressRequests: (app) => app.use((req, res, next) => {
    log.push({type: 'express', msg: req.method + ' ' + req.path})
    next()
  }),
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

  const testUser = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'johndoe@example.com'
  }

  it('should create a contact in the CRM', async () => {
    await request(app).post('/contacts')
      .set('cotent-type', 'application/json')
      .send(testUser)
    const index = log.findIndex(entry => entry.type === 'fetch' && entry.url.match(/^https:\/\/civicrm\//))
    log[index].url.should.startWith(crmUrl)
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
