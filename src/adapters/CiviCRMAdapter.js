const methodMapping = {
  post: 'create',
  get: 'get',
  put: 'update',
  delete: 'delete'
}

module.exports = (fetch, config) => {
  async function fetchFromCRM(path, method, body) {
    const crmPath = config.civicrm.url + '/sites/all/modules/civicrm/extern/rest.php?'
    const params = {
      key: config.civicrm.sitekey,
      api_key: config.civicrm.apikey,
      json: 1,
      entity: path.replace(/^\//, ''),
      action: methodMapping[method.toLowerCase()],
      ...body
    }
    const paramStr = Object.keys(params).map(key => (key + '=' + encodeURIComponent(params[key]))).join('&')
    const result = await fetch(crmPath + paramStr, {method: 'POST'})
    if (!result.ok) {
      console.error(result.status + ' ' + result.statusText)
      throw Error(`Cannot access CiviCRM on ${crmPath}`)
    }
    const data = await result.json()
    if (data.is_error) {
      console.error(data)
      throw Error('CiviCRM returned an error')
    }
    return data
  }

  return {
    async createContact(data) {
      const result = await fetchFromCRM('/contact', 'POST', {json: JSON.stringify({contact_type: 'Individual', ...data})})
      return Object.values(result.values)[0]
    },

    async updateContact(id, change) {
      return fetchFromCRM('/contact', 'PUT', {id, json: JSON.stringify(change)})
    },

    async getContactByEMail(email) {
      const result = await fetchFromCRM('/contact', 'GET', {email})
      if (result.is_error || !result.values || Object.keys(result.values).length === 0) {
        return undefined
      }
      return Object.values(result.values)[0]
    }
  }
}