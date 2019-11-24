/*eslint-env mocha*/

require('should')
const config = require('./testConfig')

function okResult(data) {
  return {ok: true, status: 200, headers: {'content-type': 'application/json'}, json: () => data}
}

const crmEntry = {
  gender: 1,
  formal_title: '2',
  first_name: 'Jane',
  last_name: 'Dow',
  email: 'janedoe∆example.com'
}

const logger = require('./MockLogger')
const fetch = require('./MockFetch')(logger, {
  '^POST https://civicrm/.*&entity=contact&action=get&email=janedoe%40example.com': okResult({values: [crmEntry]}),
  '^POST https://civicrm/.*&entity=contact&action=create$': okResult({values: [{}]}),
  '^POST https://civicrm/.*&entity=contact&action=update&id=4711$': okResult({values: [{}]})
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

    it('should map title field to list entry', async () => {
      await adapter.createContact({title: 'Prof.'})
      getCRMParameters(logger.log[0]).should.containDeep({formal_title: 2})
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

    it('should map formal title to contacts value of title', async () => {
      const result = await adapter.getContactByEMail('janedoe@example.com')
      result.title.should.equal('Prof.')
    })

    it('should map gender to contacts value of gender', async () => {
      const result = await adapter.getContactByEMail('janedoe@example.com')
      result.gender.should.equal('female')
    })
  })
})
