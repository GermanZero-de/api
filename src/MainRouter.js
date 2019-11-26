const path = require('path')
const express = require('express')
const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')
const Redirection = require('./Redirection')

module.exports = (adapters, controller, auth) => {

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
        if (error instanceof Redirection) {
          res.redirect(error.redirect)
          next()
        } else {
          res.status(error.status || 500).json(error)
          next(error)
        }
      }
    }
  }

  async function createMember(data) {
    const auth = await adapters.RocketChatAdapter.loginAsAdmin()
    await adapters.RocketChatAdapter.createUser(auth, {
      name: data.firstName + ' ' + data.lastName,
      username: data.firstName + '.' + data.lastName,
      email: data.email,
      password: data.password
    })
    await adapters.RocketChatAdapter.logout(auth)

    const wekanAuth = await adapters.WekanAdapter.loginAsAdmin()
    await adapters.WekanAdapter.createUser(wekanAuth, {
      username: data.firstName + '.' + data.lastName,
      email: data.email,
      password: data.password
    })
    await adapters.WekanAdapter.logout(wekanAuth)

    return {httpStatus: 201}
  }

  const router = express.Router()
  const oas3Document = YAML.load(path.resolve(__dirname, '..', 'openapi.yaml'))

  router.use('/api-ui', swaggerUi.serve, swaggerUi.setup(oas3Document))
  router.get('/', (req, res) => res.redirect('api-ui'))

  router.post('/session', nocache, jsonHandlerFor(req => auth.login(req.body)))
  
  router.post('/contacts', nocache, jsonHandlerFor(req => controller.registerContact(req.body)))
  router.get('/contacts/:id/confirmations/:code', jsonHandlerFor(req => controller.confirmRegistration(req.params.id, req.params.code)))

  router.post('/contacts/mc-webhooks/:code', jsonHandlerFor(req => controller.mailChimpWebhook(req.params.code, req.body)))

  router.post('/members', nocache, auth.bearerAuth, jsonHandlerFor(req => createMember(req.body)))

  return router
}
