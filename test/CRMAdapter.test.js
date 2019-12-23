/*eslint-env mocha*/

require('should')
const config = require('./testConfig')

const jsonContentType = 'application/json'
function okResult(data) {
  const headers = {
    get: which => which === 'content-type' ? jsonContentType : undefined
  }
  return {ok: true, status: 200, headers, json: () => data}
}

const crmEntry = {
  gender: 1,
  formal_title: 'Prof.',
  first_name: 'Jane',
  last_name: 'Dow',
  email: 'janedoe∆example.com'
}

const logger = require('./MockLogger')
const fetch = require('./MockFetch')(logger, {
  '^POST https://civicrm/.*entity=country&action=get': okResult({values: []}),
  '^POST https://civicrm/.*%22email%22%3A%22janedoe%40example.com%22.*&entity=contact&action=get$': okResult({values: [crmEntry]}),
  '^POST https://civicrm/.*&entity=contact&action=create$': okResult({values: [{}]}),
  '^POST https://civicrm/.*&entity=address&action=create': okResult({values: [{}]}),
  '^POST https://civicrm/.*id%22%3A4711.*&entity=contact&action=create$': okResult({values: [{}]})
})

const adapter = require('../src/adapters/CiviCRMAdapter')(fetch, config)

function getCRMParameters(logEntry) {
  const url = new URL(logEntry.debug.fetch.url)
  return JSON.parse(decodeURIComponent(url.search.match(/json=([^&]*)/)[1]))
}

describe('CiviCRMAdapter', () => {
  beforeEach(() => logger.reset())

  describe('createContact', () => {
    it('should map contact fields to CRM fields', async () => {
      await adapter.createContact({firstName: 'John', lastName: 'Doe', email: 'johndoe@example.com'})
      Object.keys(getCRMParameters(logger.log[0])).should.containDeep(['first_name', 'last_name', 'email'])
    })

    it('should map gender field to list entry', async () => {
      await adapter.createContact({gender: 'male'})
      getCRMParameters(logger.log[0]).should.containDeep({gender: 2})
    })

    it('should calculate prefix from gender', async () => {
      await adapter.createContact({gender: 'female'})
      getCRMParameters(logger.log[0]).should.containDeep({prefix_id: 1})
    })
  })

  describe('updatecontact', () => {
    it('should map contact fields to CRM fields', async () => {
      await adapter.updateContact(4711, {firstName: 'John', lastName: 'Doe', email: 'johndoe@example.com'})
      Object.keys(getCRMParameters(logger.log[0])).should.containDeep(['first_name', 'last_name', 'email'])
    })

    it('should only overwrite the given fields', async () => {
      await adapter.updateContact(4711, {firstName: 'John', })
      Object.keys(getCRMParameters(logger.log[0])).should.not.containEql('last_name')
    })
  })

  describe('getContactByEMail', () => {
    it('should map CRM fields to contact fields', async () => {
      const result = await adapter.getContactByEMail('janedoe@example.com')
      Object.keys(result).should.containEql('lastName')
    })

    it('should map gender to contacts value of gender', async () => {
      const result = await adapter.getContactByEMail('janedoe@example.com')
      result.gender.should.equal('female')
    })
  })
})
