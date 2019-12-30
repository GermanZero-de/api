const {setCountries, mapContact2CrmFields, mapCrm2ContactFields} = require('../mapper/CrmMapper')

module.exports = (fetch, config) => {
  let id = -1

  async function fetchFromCRM(entity, action, body) {
    if (!config.civicrm.url) {
      return {values: [{id: id--, ...body}]}
    }
    const crmPath = config.civicrm.url + '/sites/all/modules/civicrm/extern/rest.php?'
    const params = {
      key: config.civicrm.sitekey,
      api_key: config.civicrm.apikey,
      json: JSON.stringify(body),
      entity,
      action
    }
    const paramStr = Object.keys(params).map(key => (key + '=' + encodeURIComponent(params[key]))).join('&')
    // console.log(crmPath + paramStr)
    const result = await fetch(crmPath + paramStr, {method: 'POST'})
    if (!result.ok) {
      console.error(result.status + ' ' + result.statusText)
      throw Error(`Cannot access CiviCRM on ${crmPath}`)
    }
    const data = result.headers.get('content-type').match(/json/) ? await result.json() : await result.text()
    if (data.is_error) {
      console.error(data)
      throw Error('CiviCRM returned an error')
    }
    return data
  }

  const countriesLoaded = fetchFromCRM('country', 'get', {sequential: true, options: {limit: 99999}})
    .then(countries => setCountries(Object.assign({}, ...countries.values.map(e => ({[e.iso_code]: e.id})))))

  return {
    async upsertContact(data) {
      await countriesLoaded
      const fields = mapContact2CrmFields(data)
      const contact = await fetchFromCRM('contact', 'create', {contact_type: 'Individual', ...fields.contact})
      let address = {}
      if (Object.values(fields.address).some(property => property)) {
        address = await fetchFromCRM('address', 'create', {contact_id: contact.id, location_type: 'Home', ...fields.address})
      }
      let websites = []
      if (fields.websites) {
        websites = await Promise.all(fields.websites.map(website => fetchFromCRM('website', 'create', {contact_id: contact.id, ...website})))
      }
      let tags = []
      if (fields.tags) {
        tags = await Promise.all(fields.tags.map(tag => fetchFromCRM('EntityTag', 'create', {entity_id: contact.id, entity_table: 'civicrm_contact', tag_id: tag})))
      }
      return {contact, address, websites, tags}
    },

    async updateContact(id, change) {
      const fields = mapContact2CrmFields(change).contact
      const result = await fetchFromCRM('contact', 'create', {id, sequential: true, ...fields})
      return result.values[0]
    },

    async getContactByEMail(email) {
      const result = await fetchFromCRM('contact', 'get', {email, sequential: true})
      if (result.is_error || !result.values || Object.keys(result.values).length === 0) {
        return undefined
      }
      return mapCrm2ContactFields(result.values[0])
    },

    async getAllContacts() {
      await countriesLoaded
      const result = await fetchFromCRM('contact', 'get', {
        sequential: true,
        options: {limit: 99999},
        return: 'id,is_opt_out,first_name,last_name,prefix_id,formal_title,gender_id,address_id,street_address,postal_code,city,country_id,country,phone,email,tag',
        'api.Website.get': {}
      })
      return result.values.map(mapCrm2ContactFields)
    }
  }
}