module.exports = function fetch(url, options) {
  const userName = JSON.parse(options.body).user
  const data = {
    userId: 'my-user-id',
    authToken: 'secret-auth-token',
    me: {
      name: userName,
      email: userName + '@nintendo',
      roles: ['user']
    }
  }
  if (userName === 'mario') {
    data.me.roles.push('admin')
  }
  const valid = (userName !== 'invalidUser')
  const body = {
    status: valid ? 'success' : 'error',
    data: valid ? data : undefined
  }
  return Promise.resolve({ok: true, json: () => Promise.resolve(body)})
}
