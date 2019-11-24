/* eslint-env mocha */

const should = require('should')
const fs = require('fs')
const path = require('path')
const fetch = require('./MockRocketChatLogin')
const Auth = require('../src/auth')

process.env.TEAM_URL = 'https://authentication.site'

const log = []
const logger = {
  error: (error) => log.push({error}),
  debug: (debug) => log.push({debug}),
}

const auth = Auth(fetch, logger)

describe('auth module', () => {
  describe('Login', () => {
    it('should login valid users', async () => {
      const token = await auth.login('mario', 'marios-password')
      token.should.startWith('ey')
    })

    it('should reject invalid users', async () => {
      await auth.login('invalidUser', 'invalid-password')
        .then(result => result.should.fail)
        .catch(error => error.should.deepEqual({status: 401, message: `Couldn't login with the given credentials`}))
    })

    it(`should deny access to users not in group 'admin'`, async() => {
      await auth.login('luigi', 'luigis-password')
        .then(result => result.should.fail)
        .catch(error => error.should.deepEqual({status: 401, message: 'Couldn\'t login with the given credentials'}))
    })
  })

  describe('Authentication', () => {
    it('should accept valid tokens', done => {
      auth.login('mario', 'marios-password').then(validToken => {
        auth.bearerAuth({headers: {authorization: 'Bearer ' + validToken}}, {}, error => {
          should(error).be.empty
          done()
        })
      })
    })

    it('should require JWT token in authorization header', done => {
      auth.bearerAuth({headers: {}}, {}, error => {
        error.should.deepEqual({status: 401, message: 'Missing authorization header'})
        done()
      })
    })

    it('should reject tokens that cannot be verified', done => {
      auth.bearerAuth({headers: {authorization: 'Bearer ' + fs.readFileSync(path.resolve(__dirname, 'token_other_signature')).toString().trim()}}, {}, error => {
        error.should.deepEqual({status: 401, message: `invalid signature`})
        done()
      })
    })

    it('should reject expired tokens', done => {
      auth.bearerAuth({headers: {authorization: 'Bearer ' + auth.createToken({}, -1)}}, {}, error => {
        error.should.deepEqual({status: 401, message: `jwt expired`})
        done()
      })
    })

    it('should require that the JWT contains the required attributes', done => {
      const token = auth.createToken({})
      auth.bearerAuth({headers: {authorization: 'Bearer ' + token}}, {}, error => {
        error.should.deepEqual({status: 401, message: `JWT Token doesn't contain all required attributes`})
        done()
      })
    })
  })
})
