/*eslint-env node*/

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')
const stream = require('stream')
const es = require('event-stream')

const exists = path => {
  try {
    return fs.existsSync(path)
  } catch (e) {
    return false
  }
}

class JsonStringify extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    this.push(JSON.stringify(event) + '\n')
    callback()
  }
}

class EventStore {
  constructor({basePath, logger}) {
    this.logger = logger
    this.listeners = []
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath)
    }
    const versionFile = path.resolve(basePath, 'version.json')
    const eventsVersionNo = !exists(versionFile) ? 0 : JSON.parse(fs.readFileSync(versionFile).toString()).versionNo
    const migrationsDir = path.resolve(__dirname, 'migrations')
    const migrationFiles = !exists(migrationsDir) ? [] : fs.readdirSync(migrationsDir)
      .filter(name => parseInt(name.replace('from_', '')) >= eventsVersionNo)
      .map(name => path.resolve(migrationsDir, name))
    const versionNo = eventsVersionNo + migrationFiles.length
    this.eventsFileName = path.join(basePath, `events-${versionNo}.json`)
    if (eventsVersionNo < versionNo) {
      this.logger.info(`Migrating data from ${eventsVersionNo} to ${versionNo}`)
      this.ready = this
        .migrate(basePath, eventsVersionNo, migrationFiles)
        .then(() => fs.writeFileSync(versionFile, JSON.stringify({versionNo})))
        .then(() => this.logger.info('Migration successful'))
        .then(() => this.openChangeStream())
    } else {
      this.openChangeStream()
      this.ready = Promise.resolve()
    }
  }

  openChangeStream() {
    this.changeStream = fs.createWriteStream(this.eventsFileName, {flags: 'a'})
  }

  migrate(basePath, fromVersion, migrationFiles) {
    return new Promise(resolve => {
      const fileExt = fromVersion <= 3 ? 'yaml' : 'json'
      const oldVersionExt = fromVersion < 12 ? '' : '-' + fromVersion
      const oldEventsFile = path.join(basePath, `events${oldVersionExt}.${fileExt}`)
      if (!fs.existsSync(oldEventsFile)) {
        resolve()
      } else {
        const readStream = fromVersion <= 3
          ? es.readArray(YAML.parse(fs.readFileSync(oldEventsFile).toString()))
          : fs.createReadStream(oldEventsFile).pipe(es.split()).pipe(es.parse())
        readStream.on('end', resolve)

        migrationFiles
          .map(migration => require(migration))
          .reduce((stream, migrator) => stream.pipe(new migrator()), readStream)
          .pipe(new JsonStringify())
          .pipe(fs.createWriteStream(this.eventsFileName))
      }
    })
  }

  listen(listener) {
    this.listeners.push(listener)
  }

  static assert(event, condition, message) {
    if (!condition) {
      const originalFunc = Error.prepareStackTrace
      const err = new Error()
      Error.prepareStackTrace = (err, stack) => stack.map(e => e.getFileName())
      const currentfile = err.stack.shift()
      const callerFile = err.stack.find(s => s !== currentfile).split(/[\\/]/).pop()
      Error.prepareStackTrace = originalFunc
      throw `Read model '${callerFile}', event '${event.type}' (${event.ts}): ${message}`
    }
  }

  async replay() {
    await this.ready
    const self = this
    fs.createReadStream(this.eventsFileName)
      .pipe(es.split())
      .pipe(es.parse())
      .pipe(es.mapSync(event => {
        try {
          self.listeners.forEach(listener => {
            listener(event, (condition, message) => EventStore.assert(event, condition, message), 'replay')
          })
        } catch (error) {
          self.logger.error(error)
          self.logger.debug(error.stack)
        }
      }))
  }

  async add(event) {
    const self = this
    await this.ready
    const {type, ...rest} = event
    const completeEvent = {ts: new Date(), type, ...rest}
    this.changeStream.write(JSON.stringify(completeEvent) + '\n')
    this.listeners.forEach(listener => {
      try {
        listener(completeEvent, (condition, message) => EventStore.assert(completeEvent, condition, message), 'new')
      } catch (error) {
        self.logger.error(error)
        self.logger.debug(error.stack)
      }
    })
    
  }

  deleteAll() {
    if (fs.existsSync(this.eventsFileName)) {
      fs.unlinkSync(this.eventsFileName)
    }
  }

  end() {
    this.changeStream.end()
  }
}

module.exports = EventStore
