module.exports = (fetch, config) => {
  async function fetchFromWekan(path, method, body, auth) {
    const headers = {'content-type': 'application/json'}
    if (auth) {
      headers['Authorization'] = 'Bearer ' + auth.token
    }
    const result = await fetch(config.wekan.url + path, {method, body: JSON.stringify(body), headers})
    if (!result.ok) {
      console.log({error: 'Cannot access Wekan', statusText: result.statusText, details: await result.text()})
      throw Error(`Cannot access Wekan on ${config.wekan.url}`)
    }
    return result.json()
  }

  return {
    async loginAsAdmin() {
      return fetchFromWekan('/users/login', 'POST', {username: config.wekan.adminUsername, password: config.wekan.adminPwd})
    },

    async logout() {
      // There seems to be no logout API route in Wekan...?
      return null
    },

    async createUser(auth, data) {
      const result = await fetchFromWekan('/api/users', 'POST', data, auth)
      if (result.error) {
        throw Error(`Wekan reported an error when creating a user: ${result.message}`)
      }
      return result
    }
  }
}