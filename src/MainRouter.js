const express = require('express')
const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')

const router = express.Router()
const oas3Document = YAML.load('./openapi.yaml')

router.use('/api-ui', swaggerUi.serve, swaggerUi.setup(oas3Document))
router.get('/', (req, res) => res.redirect('api-ui'))

module.exports = router

function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.header('Expires', '-1')
  res.header('Pragma', 'no-cache')
  next()
}

function jsonHandlerFor(func) {
  return async (req, res, next) => {
    try {
      res.json(await func(req))
    } catch (error) {
      res.status(error.status || 500).json(error)
      next(error)
    }
  }
}
