const fs = require('fs')
const path = require('path')
const express = require('express')
const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')
const Redirection = require('./Redirection')

module.exports = (adapters, controller, auth, logger) => {

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
        if (result instanceof Redirection) {
          res.redirect(result.redirect)
          next()
        } else {
          res.status(result.httpStatus || 200).json(result)
        }
      } catch (error) {
        logger.debug(error)
        res.status(error.status || 500).json(error)
      }
    }
  }

  async function createUser(data) {
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

  function getInfo() {
    const commitInfo = fs.readFileSync(path.resolve(__dirname, '..', 'info.txt')).toString().split('\n').filter(line => line)
    return {
      commitId: commitInfo[0].match(/\s+(.*)/)[1],
      author: commitInfo[1].match(/\s+(.*)/)[1],
      date: commitInfo[2].match(/\s+(.*)/)[1],
      message: commitInfo.slice(3).map(line => line.trim()).join('\n')
    }
  }

  const router = express.Router()
  const oas3Document = YAML.load(path.resolve(__dirname, '..', 'openapi.yaml'))

  router.use('/api-ui', swaggerUi.serve, swaggerUi.setup(oas3Document))
  router.get('/', (req, res) => res.redirect('api-ui'))
  router.get('/info', (req, res) => res.json({commitInfo: getInfo()}))
  
  router.post('/subscriptions', nocache, jsonHandlerFor(req => controller.registerForNewsletter(req.body)))
  router.post('/members', nocache, jsonHandlerFor(req => controller.registerAsVolunteer(req.body)))
  router.get('/contacts/:id/confirmations/:code', jsonHandlerFor(req => controller.confirmRegistration(req.params.id, req.params.code)))
  router.get('/contacts/:id/unsubscribe/:code', jsonHandlerFor(req => controller.unsubscribe(req.params.id, req.params.code)))
  router.post('/contacts/mc-webhooks/:code', jsonHandlerFor(req => controller.mailChimpWebhook(req.params.code, req.body)))

  router.post('/session', nocache, jsonHandlerFor(req => auth.login(req.body)))
  router.post('/users', nocache, auth.bearerAuth, jsonHandlerFor(req => createUser(req.body)))

  return router
}
