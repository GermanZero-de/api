const path = require('path')
const express = require('express')
const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')

module.exports = (fetch, config) => {
  function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    res.header('Expires', '-1')
    res.header('Pragma', 'no-cache')
    next()
  }

  function jsonHandlerFor(func) {
    return async (req, res, next) => {
      try {
        const result = await func(req)
        res.status(result.httpStatus || 200).json(result)
      } catch (error) {
        res.status(error.status || 500).json(error)
        next(error)
      }
    }
  }

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
    const data = result.json()
    if (!data.status || data.status !== 'success') {
      throw Error('Rocket.Chat returned an error')
    }
    return data.data
  }

  async function createMember(data) {
    const {userId, authToken} = await fetchFromRC('/api/v1/login', 'POST', {user: config.rocketChat.adminUsername, password: config.rocketChat.adminPwd})
    const body = {
      name: data.firstName + ' ' + data.lastName,
      email: data.email,
      password: data.password
    }
    await fetchFromRC('/api/v1/users.create', 'POST', body, {userId, authToken})
    await fetchFromRC('/api/v1/logout', 'POST', {}, {userId, authToken})
    return {httpStatus: 201}
  }

  const router = express.Router()
  const oas3Document = YAML.load(path.resolve(__dirname, '..', 'openapi.yaml'))

  router.use('/api-ui', swaggerUi.serve, swaggerUi.setup(oas3Document))
  router.get('/', (req, res) => res.redirect('api-ui'))
  router.post('/members', jsonHandlerFor(req => createMember(req.body)))

  return router
}
