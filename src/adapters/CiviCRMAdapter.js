const {setCountries, mapContact2CrmFields, mapCrm2ContactFields} = require('../mapper/CrmMapper')

const fieldList = 'id,is_opt_out,first_name,last_name,prefix_id,formal_title,gender_id,address_id,street_address,postal_code,city,country_id,country,phone,email,tag'

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
    async getSingleContact(where) {
      const result = await fetchFromCRM('contact', 'get', {...where, return: fieldList, sequential: true})
      if (result.is_error || !result.values || Object.keys(result.values).length === 0) {
        return undefined
      }
      return mapCrm2ContactFields(result.values[0])
    },

    async upsertContact(data) {
      await countriesLoaded
      const fields = mapContact2CrmFields(data)
      if (!data.id) {
        fields.contact.contact_type = 'Individual'
      }
      const contact = await fetchFromCRM('contact', 'create', fields.contact)
      if (Object.values(fields.address).some(property => property)) {
        if (data.raw) {
          fields.address.id = data.raw.address_id
        }
        await fetchFromCRM('address', 'create', {contact_id: contact.id, location_type: 'Home', ...fields.address})
      }
      if (fields.websites) {
        await Promise.all(fields.websites.map(website => fetchFromCRM('website', 'create', {contact_id: contact.id, ...website})))
      }
      if (data.tags) {
        const newTags = data.tags.filter(tag => !data.raw || !data.raw.tags || !data.raw.tags.includes(tag))
        await Promise.all(newTags.map(tag => fetchFromCRM('EntityTag', 'create', {entity_id: contact.id, entity_table: 'civicrm_contact', tag_id: tag})))
      }
      const result = await fetchFromCRM('contact', 'get', {id: contact.id, return: fieldList, sequential: true})
      if (result.is_error || !result.values || Object.keys(result.values).length === 0) {
        return undefined
      }
      return this.getSingleContact({id: contact.id})
    },

    async updateContact(id, change) {
      const fields = mapContact2CrmFields(change).contact
      await fetchFromCRM('contact', 'create', {id, sequential: true, ...fields})
      return this.getSingleContact({id})
    },

    async getContactByEMail(email) {
      return this.getSingleContact({email})
    },

    async getAllContacts() {
      await countriesLoaded
      const result = await fetchFromCRM('contact', 'get', {
        sequential: true,
        options: {limit: 99999},
        return: fieldList,
        'api.Website.get': {}
      })
      return result.values.map(mapCrm2ContactFields)
    }
  }
}