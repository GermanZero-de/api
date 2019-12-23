const contactMapping = {
  id: 'id',
  gender: 'gender',
  formal_title: 'title',
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  phone: 'phone',
  is_opt_out: 'is_opt_out',
}

const addressMapping = {
  street_address: 'streetAddress',
  postal_code: 'postalCode',
  city: 'city',
  country: 'country'
}

const genders = {
  female: 1,
  male: 2,
  other: 3
}
const prefixes = {
  female: 1,
  male: 3
}
const titles = { 'Dr.': 1, 'Prof.': 2, 'Dr. Dr.': 3, 'Prof. Dr.': 4, 'Prof. Dr. Dr.': 5 }
let countries = []
const websiteTypes = {
  linkedin: 6,
  xing: 13,
  instagram: 5,
  twitter: 11
}

function lookup(list, value) {
  return value && list[value]
}

function setFieldIfNotEmpty(object, fieldName, value) {
  if (value) {
    object[fieldName] = value
  }
}

module.exports = {
  setCountries(list) {
    countries = list
  },

  mapContact2CrmFields(data) {
    const contact = {}
    Object.keys(contactMapping).forEach(key => setFieldIfNotEmpty(contact, key, data[contactMapping[key]]))
    setFieldIfNotEmpty(contact, 'gender', lookup(genders, data.gender))
    contact.prefix_id = prefixes[data.gender]

    const address = {}
    Object.keys(addressMapping).forEach(key => setFieldIfNotEmpty(address, key, data[addressMapping[key]]))
    setFieldIfNotEmpty(address, 'country', lookup(countries, data.country))
    if (address.street_address && data.houseNumber) {
      address.street_address += ' ' + data.houseNumber
    }

    const websites = Object.keys(websiteTypes)
      .filter(type => data[type])
      .map(type => ({ url: data[type], website_type_id: websiteTypes[type] }))

    return {
      contact,
      address,
      websites,
    }
  },

  mapCrm2ContactFields(data) {
    const result = {
      id: data.contact_id,
      is_opt_out: data.is_opt_out,
      firstName: data.first_name,
      lastName: data.last_name,
      title: data.formal_title,
      streetAddress: data.street_address,
      city: data.city,
      postalCode: data.postal_code,
      country: data.country,
      phone: data.phone,
      email: data.email,
      gender: Object.keys(genders).find(g => genders[g] === data.gender),
      tags: data.tags && data.tags.split(',')
    }
    Object.keys(websiteTypes).forEach(type => {
      const entry = data['api.Website.get'] && data['api.Website.get'].values.find(e => +e.website_type_id === websiteTypes[type])
      if (entry) {
        result[type] = entry.url
      }
    })
    return result
  },

  getKnownGenders() {
    return Object.keys(genders)
  },

  getKnownTitles() {
    return Object.keys(titles)
  }
}
