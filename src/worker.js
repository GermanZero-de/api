module.exports = async function worker(models, controller, logger, timer = global) {
  await models.isReady
  let request
  let result
  let timerInstance
  try {
    request = await models.contacts.getFirstRequest()
    if (request) {
      switch (request.type) {
        case 'create-contact':
          result = await controller.doContactRegistration(request.contact)
          break

        case 'confirm-contact':
          result = await controller.doConfirmRegistration(request.contactId)
          break
      }
      if (result && result.httpStatus > 399) {
        throw result
      } else {
        timerInstance = timer.setTimeout(() => worker(models, controller, logger, timer), 1)
      }
    } else {
      timerInstance = timer.setTimeout(() => worker(models, controller, logger, timer), 1000)
    }
  } catch (error) {
    models.contacts.markRequestAsFailing(request)
    logger.error({ message: 'FATAL: worker got an error on processing an event: ' + error.message, stack: error.stack})
    timerInstance = timer.setTimeout(() => worker(models, controller, logger, timer), 1000)
  }
  return {
    close() {
      timerInstance.close()
    }
  }
}
