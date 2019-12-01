const fieldMapping = {
  id: 'id',
  gender: 'gender',
  formal_title: 'title',
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  phone: 'phone',
  street_address: 'streetAddress',
  postal_code: 'postalCode',
  city: 'city',
  is_opt_out: 'is_opt_out'
}

const genders = ['female', 'male', 'other']
const titles = ['Dr.', 'Prof.']

function lookup(list, value) {
  return value && list.findIndex(e => e === value) + 1
}

function setFieldIfNotEmpty(object, fieldName, value) {
  if (value) {
    object[fieldName] = value
  }
}

module.exports = {
  mapContact2CrmFields(data) {
    const result = {}
    Object.keys(fieldMapping).forEach(key => setFieldIfNotEmpty(result, key, data[fieldMapping[key]]))
    setFieldIfNotEmpty(result, 'formal_title', lookup(titles, result.formal_title))
    setFieldIfNotEmpty(result, 'gender', lookup(genders, result.gender))
    if (result.gender < 3 && result.gender > 0) {
      result.prefix_id = result.gender
    }
    return result
  },

  mapCrm2ContactFields(data) {
    const result = {}
    Object.keys(fieldMapping).forEach(key => setFieldIfNotEmpty(result, fieldMapping[key], data[key]))
    setFieldIfNotEmpty(result, 'title', titles[result.title - 1])
    setFieldIfNotEmpty(result, 'gender', genders[result.gender - 1])
    return result
  }
}
