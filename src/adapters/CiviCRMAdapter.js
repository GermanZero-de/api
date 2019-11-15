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
    return result.json()
  }

  return {
    async loginAsAdmin() {
      // CiviCRM doesn't have a login/logout functionality in their API
      return null
    },

    async logout() {
      // CiviCRM doesn't have a login/logout functionality in their API
    },

    async createContact(data) {
      const result = await fetchFromCRM('/contact', 'POST', {json: JSON.stringify({contact_type: 'Individual', ...data})})
      if (result.is_error) {
        console.error(result)
        throw Error('CiviCRM returned an error')
      }  
      return result.values
    }
  }
}