const fs = require('fs')

module.exports = (fetch, config) => {
  return Object.assign({}, ...fs.readdirSync(__dirname)
    .filter(file => file !== 'index.js')
    .map(file => file.replace(/.js$/, ''))
    .map(file => ({[file]: require('./' + file)(fetch, config)}))
  )
}
