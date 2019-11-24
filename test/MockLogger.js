const log = []

module.exports = {
  log,
  reset: () => log.length = 0,
  error: (error) => log.push({error}),
  warn: (warn) => log.push({warn}),
  info: (info) => log.push({info}),
  debug: (debug) => log.push({debug}),
}
