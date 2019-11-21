const jwt = require('jsonwebtoken')
const { generateKeyPairSync } = require('crypto')

module.exports = function (fetch, logger) {
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'}
  })
  const signOptions = {expiresIn: 60 * 60, algorithm: 'RS512'}

  function verifyToken(token) {
    try {
      return jwt.verify(token, publicKey, {ignoreExpiration: false})
    } catch (error) {
      throw {
        status: 401,
        message: error.message
      }
    }
  }

  return {
    bearerAuth (req, res, next) {
      const token = (req.headers.authorization || '').replace(/^Bearer /, '')
      if (!token) {
        return next({status: 401, message: 'Missing authorization header'})
      }
      try {
        const {userId, authToken, name, email, roles} = verifyToken(token)
        if (!userId || !authToken || !name || !email || !roles) {
          return next({status: 401, message: `JWT Token doesn't contain all required attributes`})
        }
  
        next()
      } catch (error) {
        next(error)
      }
    },

    createToken (data, timeout) {
      return jwt.sign(data, privateKey, {...signOptions, expiresIn: timeout || signOptions.expiresIn})
    },

    async login (user, password) {
      const headers = {'content-type': 'application/json'}
      try{
        const result = await fetch(process.env.TEAM_URL + '/api/v1/login', {method: 'POST', headers, body: JSON.stringify({user, password})})
        if (result.ok) {
          const data = await result.json()
          if (data.status === 'success') {
            if (!data.data.me.roles.includes('admin')) {
              throw {status: 403, message: `User ${user} is not allowed to use this service`}
            }

            const {data: {userId, authToken, me: {name, email, roles}}} = data
            return this.createToken({userId, authToken, name, email, roles})
          }
        }
      } catch(error) {
        // fetch failed technically
        logger.error({msg: 'Authentication towards teamchat failed', error})
      }
      throw {status: 401, message: `Couldn't login with the given credentials`}
    }
  }
}
