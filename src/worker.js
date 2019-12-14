module.exports = async function worker(models, controller, logger, timer = global) {
  try {
    await models.isReady
    let result
    const request = await models.contacts.getFirstRequest()
    if (request) {
      switch (request.type) {
        case 'create-contact':
          result = await controller.doContactRegistration(request.contact)
          break

        case 'confirm-contact':
          result = await controller.doConfirmRegistration(request.contactId)
          break
      }
      if (result.httpStatus > 399) {
        throw result
      } else {
        timer.setTimeout(() => worker(models, controller, logger, timer), 1)
      }
    } else {
      timer.setTimeout(() => worker(models, controller, logger, timer), 1000)
    }
  } catch (error) {
    logger.error({ message: 'FATAL: worker got an error on processing an event: ' + error.message})
  }
}
