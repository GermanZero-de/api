module.exports = async function worker(models, controller, timer = global) {
  await models.isReady
  const request = await models.contacts.getFirstRequest()
  if (request) {
    switch (request.type) {
      case 'create-contact':
        await controller.doContactRegistration(request.contact)
        break

      case 'confirm-contact':
        await controller.doConfirmRegistration(request.contactId)
        break
    }
    timer.setTimeout(() => worker(models, controller, timer), 1)
  } else {
    timer.setTimeout(() => worker(models, controller, timer), 1000)
  }
}
