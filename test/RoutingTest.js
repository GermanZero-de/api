const request = require('supertest')
const logger = require('../src/Logger')
const Server = require('../src/Server')
const should = require('should')

const jsonContentType = 'application/json'

function okResult(data) {
  return {ok: true, status: 200, headers: {'content-type': jsonContentType}, json: () => data}
}

const expectedFetchResults = {
  'POST https://rocket.chat/api/v1/users.create': okResult({success: true}),
  'POST https://rocket.chat/api/v1/login': okResult({status: 'success', data: {}}),
  'POST https://rocket.chat/api/v1/logout': okResult({}),
}

const fetchLog = []
const fetch = async (url, options) => {
  fetchLog.push({url, options})
  const path = (options.method || 'GET').toUpperCase() + ' ' + url
  return expectedFetchResults[path] || { status: 404 }
}

const config = {
  rocketChat: {
    url: 'https://rocket.chat',
    adminPwd: 'rc-admin-pwd'
  },
  isProduction: false,
  nodeenv: 'test'
}
const app = Server(logger, fetch, config)

describe('GET /', () => {
  it('should redirect to /api-ui', async () => {
    const res = await request(app).get('/')
    should(res.status).equal(302)
    res.headers.location.should.equal('api-ui')
  })
})

describe('POST /members', () => {
  before(() => fetchLog.length = 0)

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
    fetchLog.length.should.equal(3)
    fetchLog[0].url.should.equal('https://rocket.chat/api/v1/login')
    fetchLog[1].url.should.equal('https://rocket.chat/api/v1/users.create')
    fetchLog[1].options.method.should.equal('POST')
    const body = JSON.parse(fetchLog[1].options.body)
    body.name.should.equal(`${testUser.firstName} ${testUser.lastName}`)
    body.email.should.equal(testUser.email)
    body.password.should.equal(testUser.password)
  })
})
