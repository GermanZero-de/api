/* eslint-env mocha */

const should = require('should')
const fs = require('fs')
const path = require('path')
const EventStore = require('../src/EventStore')
const logger = require('./MockLogger')

const testEvent = { type: 'test-event', test: { id: 99 } }

describe('EventStore', () => {
  let store

  describe('add', () => {
    beforeEach(() => {
      logger.reset()
      fs.unlinkSync(path.resolve(__dirname, 'events-0.json'))
      store = new EventStore({basePath: __dirname, logger})
    })
  
    it('should log events as JSON in a file', async () => {
      await store.add(testEvent)
      return new Promise((resolve) => setTimeout(() => {
        const content = fs.readFileSync(__dirname + '/events-0.json').toString()
        const data = JSON.parse(content)
        data.should.containDeep(testEvent)
        resolve()
      }, 100))
    })
  
    it('should add a timestamp to each event', async () => {
      await store.add(testEvent)
      return new Promise((resolve) => setTimeout(() => {
        const content = JSON.parse(fs.readFileSync(__dirname + '/events-0.json').toString())
        content.ts.should.exist
        should(new Date() - new Date(content.ts)).lessThan(2000)
        resolve()
      }, 100))
    })
  
    it('should call listener with incoming events', async () => {
      store.listen((event) => event.should.containDeep(testEvent))
      await store.add(testEvent)
    })
  
    it('should call all registered listeners when an event is added', async () => {
      const listener1 = {
        isCalled: false,
        handleEvent: () => this.isCalled = true
      }
      const listener2 = {
        isCalled: false,
        handleEvent: () => this.isCalled = true
      }
      store.listen(listener1.handleEvent)
      store.listen(listener2.handleEvent)
      await store.add(testEvent)
      listener1.isCalled.should.be.true
      listener2.isCalled.should.be.true
    })

    it('should report errors in event handlers', async () => {
      store.listen((event, assert) => assert(event.type !== 'test-event', 'No test event expected'))
      await store.add(testEvent)
      logger.log[0].error.should.match(/^Read model 'EventStore.test.js', event 'test-event' \(.*\): No test event expected$/)
    })
  })

  describe('replay', () => {
    beforeEach(() => logger.reset())

    it('should replay all stored events', async () => {
      fs.writeFileSync(path.resolve(__dirname, 'events-0.json'), JSON.stringify(testEvent) + '\n')
      store = new EventStore({basePath: __dirname, logger})
      const listener = {
        isCalled: false,
        handleEvent: (event, assert, type) => {
          this.isCalled = true
          event.should.containDeep(testEvent)
          type.should.equal('replay')
        }
      }
      store.listen(listener.handleEvent)
      await store.replay()
      listener.isCalled.should.be.true
    })
  })
})
