const contactMapping = {
  id: 'id',
  gender: 'gender',
  formal_title: 'title',
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  phone: 'phone',
  is_opt_out: 'is_opt_out',
  tags: 'tag',
  custom_13: 'custom_sphere',
  custom_20: 'time'
}

const addressMapping = {
  street_address: 'streetAddress',
  postal_code: 'postalCode',
  city: 'city',
  country_id: 'country'
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
const tags = {
  Volunteer: 5,
  Newsletter: 8,
  finanzstark: 17,
  reichweitenstark: 18,
  'tatkräftig': 19,
  it: 20,
  'local-team': 21,
  accounting: 22,
  'text-ads-media': 23,
  scientific: 24,
  cooperation: 25,
  fundraising: 26,
  custom: 27
}

function lookup(list, value) {
  return value && list[value]
}

function setFieldIfNotEmpty(object, fieldName, value) {
  if (value) {
    object[fieldName] = value
  }
}

function reverseLookupCountry(country_id) {
  if (country_id) {
    const entry = Object.entries(countries).find(entry => entry[1] === country_id)
    if (entry) {
      return entry[0]
    }
  }
  return ''
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
    setFieldIfNotEmpty(address, 'country_id', lookup(countries, data.country))

    const websites = Object.keys(websiteTypes)
      .filter(type => data[type])
      .map(type => ({ url: data[type], website_type_id: websiteTypes[type] }))

    return {
      contact,
      address,
      websites,
      tags: (data.tags && data.tags.map(tag => tags[tag]).filter(tag => tag)) || []
    }
  },

  mapCrm2ContactFields(data) {
    const tags = (data.tags && data.tags.split(',')) || []
    const result = {
      id: data.id,
      is_opt_out: data.is_opt_out,
      firstName: data.first_name,
      lastName: data.last_name,
      title: data.formal_title,
      streetAddress: data.street_address,
      city: data.city,
      postalCode: data.postal_code,
      country: reverseLookupCountry(data.country_id),
      phone: data.phone,
      email: data.email,
      gender: data.gender && data.gender.toLowerCase(),
      tags,
      raw: {
        address_id: data.address_id,
        websites: [],
        tags
      }
    }
    Object.keys(websiteTypes).forEach(type => {
      const entry = data['api.Website.get'] && data['api.Website.get'].values.find(e => +e.website_type_id === websiteTypes[type])
      if (entry) {
        result[type] = entry.url
        result.raw.websites.push(entry)
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
