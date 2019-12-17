module.exports = (logger, expectedFetchResults) => {
  return async (url, options) => {
    logger.debug({fetch: {url, options}})
    const path = (options.method || 'GET').toUpperCase() + ' ' + url
    const found = Object.keys(expectedFetchResults).find(pattern => path.match(new RegExp(pattern)))
    return expectedFetchResults[found] || { status: 404, headers: {get: () => ''} }
  } 
}
