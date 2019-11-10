const path = require('path')
const express = require('express')
const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')

module.exports = (fetch, config) => {
  const RocketChatAdapter = require('./RocketChatAdapter')(fetch, config)
  const WekanAdapter = require('./WekanAdapter')(fetch, config)

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

  async function createMember(data) {
    const auth = await RocketChatAdapter.loginAsAdmin()
    await RocketChatAdapter.createUser(auth, {
      name: data.firstName + ' ' + data.lastName,
      username: data.firstName + '.' + data.lastName,
      email: data.email,
      password: data.password
    })
    await RocketChatAdapter.logout(auth)

    const wekanAuth = await WekanAdapter.loginAsAdmin()
    await WekanAdapter.createUser(wekanAuth, {
      username: data.firstName + '.' + data.lastName,
      email: data.email,
      password: data.password
    })
    await WekanAdapter.logout(wekanAuth)

    return {httpStatus: 201}
  }

  const router = express.Router()
  const oas3Document = YAML.load(path.resolve(__dirname, '..', 'openapi.yaml'))

  router.use('/api-ui', swaggerUi.serve, swaggerUi.setup(oas3Document))
  router.get('/', (req, res) => res.redirect('api-ui'))
  router.post('/members', jsonHandlerFor(req => createMember(req.body)))

  return router
}
