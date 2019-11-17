const path = require('path')
const express = require('express')
const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')
const Redirection = require('./Redirection')

module.exports = (logger, fetch, config) => {
  const {CiviCRMAdapter, WekanAdapter, RocketChatAdapter} = require('./adapters')(fetch, config)
  const MailSender = require('./MailSender')(logger, config)
  const {registerContact, confirmRegistration} = require('./controller/ContactController')(CiviCRMAdapter, MailSender, config)

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
  
  router.post('/contacts', nocache, jsonHandlerFor(req => registerContact(req.body)))
  router.get('/contacts/:id/confirmations/:code', jsonHandlerFor(req => confirmRegistration(req.params.id, req.params.code)))

  router.post('/members', nocache, jsonHandlerFor(req => createMember(req.body)))

  return router
}
