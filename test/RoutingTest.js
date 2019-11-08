const request = require('supertest')
const logger = require('../src/Logger')
const app = require('../src/Server')(false, logger)
const should = require('should')

describe('GET /', () => {
  it('should redirect to /api-ui', async () => {
    const res = await request(app).get('/')
    should(res.status).equal(302)
    res.headers.location.should.equal('api-ui')
  })
})
