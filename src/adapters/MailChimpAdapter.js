const btoa = require('btoa')
const crypto = require('crypto')

module.exports = (fetch, config, logger) => {
  const baseUrl = 'https://' + config.mailchimp.apiKey.replace(/.*-(\w+)$/, '$1') + '.api.mailchimp.com/3.0'
  const authorization = 'Basic ' + btoa('x:' + config.mailchimp.apiKey)

  async function fetchFromMC(path, options = {}) {
    options.headers = Object.assign({}, options.headers, {authorization})
    const response = await fetch(baseUrl + path, options)
    const contentType = response.headers.get('content-type')
    const content = contentType.match(/json/) ? await response.json() : await response.text()
    if (response.ok) {
      return content
    }
    throw content
  }

  function md5(data) {
    return crypto.createHash('md5').update(data).digest("hex")
  }

  return {
    async addTags(person, tags) {
      const segmentPath = `/lists/${config.mailchimp.listId}/segments`
      const segments = await fetchFromMC(segmentPath)
      if (!segments || !segments.segments) {
        logger.debug(segments)
        throw segments
      }
      return Promise.all(tags.map(async tag => {
        const segment = segments.segments.find(s => s.name === tag)
        const method = 'POST'
        if (!segment) {
          const body = JSON.stringify({name: tag, static_segment: [person.email]})
          return fetchFromMC(segmentPath, {method, body})
        } else {
          const body = JSON.stringify({email_address: person.email})
          return fetchFromMC(`${segmentPath}/${segment.id}/members`, {method, body})
        }
      })).catch(error => {
        throw error
      })
    },
  
    async addSubscriber(person) {
      const member = {
        email_address: person.email,
        merge_fields: {FNAME: person.firstName, LNAME: person.lastName}
      }
      const email = member.email_address.toLowerCase()
      const path = `/lists/${config.mailchimp.listId}/members/${md5(email)}`
      member.status = 'subscribed'
      await fetchFromMC(path, {method: 'put', body: JSON.stringify(member)})
    }
  }
}
