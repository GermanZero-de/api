module.exports = class Redirection extends Error {  
  constructor(destination) {
    super('')
    this.redirect = destination
  }
}
