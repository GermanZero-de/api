module.exports = (fetch, config) => {
  async function fetchFromRC(path, method, body, auth) {
    const headers = {'content-type': 'application/json'}
    if (auth) {
      headers['X-Auth-Token'] = auth.authToken
      headers['X-User-id'] = auth.userId
    }
    const result = await fetch(config.rocketChat.url + path, {method, body: JSON.stringify(body), headers})
    if (!result.ok) {
      throw Error(`Cannot access Rocket.Chat on ${config.rocketChat.url}`)
    }
    return result.json()
  }

  return {
    async loginAsAdmin() {
      const result = await fetchFromRC('/api/v1/login', 'POST', {user: config.rocketChat.adminUsername, password: config.rocketChat.adminPwd})
      if (!result.status || result.status !== 'success') {
        throw Error('Rocket.Chat returned an error')
      }
      const {userId, authToken} = result.data
      return {userId, authToken}
    },

    async logout(auth) {
      return fetchFromRC('/api/v1/logout', 'POST', {}, auth)
    },

    async createUser(auth, data) {
      const result = await fetchFromRC('/api/v1/users.create', 'POST', data, auth)
      if (!result.success) {
        throw Error('Rocket.Chat returned an error')
      }  
      return result.user
    }
  }
}