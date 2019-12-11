/*eslint-env mocha*/

const express = require('express')
const bodyParser = require('body-parser')
const request = require('supertest')
require('should')

function okResult(data) {
  return {ok: true, status: 200, headers: {'content-type': 'application/json'}, json: () => data}
}

const logger = require('./MockLogger')
const fetch = require('./MockFetch')(logger, {
  'POST https://rocket.chat/api/v1/users.create': okResult({success: true}),
  'POST https://rocket.chat/api/v1/login': okResult({status: 'success', data: {}}),
  'POST https://rocket.chat/api/v1/logout': okResult({}),
  'POST https://wekan/users/login': okResult({}),
  'POST https://wekan/api/users': okResult({}),
})

const auth = require('../src/auth')(fetch, logger)
const authData = {
  userId: 'my-user-id',
  authToken: 'secret-auth-token',
  name: 'mario',
  email: 'mario@nintendo',
  roles: ['admin']
}
const validToken = auth.createToken(authData, 100)

let app

const config = require('./testConfig')
const adapters = require('../src/adapters')(fetch, config)

function fetchCallsMatching(pattern) {
  return logger.log
    .filter(entry => entry.debug && entry.debug.fetch && entry.debug.fetch.url.match(pattern))
    .map(entry => entry.debug.fetch)
}

describe('POST /users', () => {
  const testUser = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'johndoe@example.com',
    password: 'my-great-secret'
  }

  beforeEach(() => {
    logger.reset()
    const mainRouter = require('../src/MainRouter')(adapters, {}, auth, logger)
    app = express()
    app.use(bodyParser.urlencoded({extended: false}))
    app.use(bodyParser.json())
    app.use(mainRouter)
    app.use((error, req, res, next) => {
      res.status(error.status || 500).json({error})
      logger.log.push({type: 'express', error, path: req.method + ' ' + req.path})
      next()
    })        
  })

  it('should require a valid authentication', async () => {
    const result = await request(app).post('/users').set('cotent-type', 'application/json').send(testUser)
    result.ok.should.be.false
    result.status.should.equal(401)
  })

  it('should create a user in Rocket.Chat', async () => {
    await request(app).post('/users')
      .set('cotent-type', 'application/json')
      .set('Authorization', 'Bearer ' + validToken)
      .send(testUser)

    const calls = fetchCallsMatching(/^https:\/\/rocket.chat\//)
    calls.length.should.equal(3)
    calls[0].url.should.equal('https://rocket.chat/api/v1/login')
    calls[0].options.method.should.equal('POST')
    calls[1].url.should.equal('https://rocket.chat/api/v1/users.create')
    calls[1].options.method.should.equal('POST')
    const body = JSON.parse(calls[1].options.body)
    body.name.should.equal(`${testUser.firstName} ${testUser.lastName}`)
    body.email.should.equal(testUser.email)
    body.password.should.equal(testUser.password)
  })

  it('should create a user in Wekan', async () => {
    await request(app).post('/users')
      .set('cotent-type', 'application/json')
      .set('Authorization', 'Bearer ' + validToken)
      .send(testUser)
    
    const calls = fetchCallsMatching(/^https:\/\/wekan\//)
    calls.length.should.equal(2)
    calls[0].url.should.equal('https://wekan/users/login')
    calls[0].options.method.should.equal('POST')
    calls[1].url.should.equal('https://wekan/api/users')
    calls[1].options.method.should.equal('POST')
    const body = JSON.parse(calls[1].options.body)
    body.username.should.equal(`${testUser.firstName}.${testUser.lastName}`)
    body.email.should.equal(testUser.email)
    body.password.should.equal(testUser.password)
  })
})
