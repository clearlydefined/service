module.exports = (request, response, next) => {
  request.query = _normalize(request.query)
  next()
}

function _normalize(query) {
  const keys = Object.keys(query)
  for (let key of keys) {
    let value = query[key]
    if (!value) continue
    value = value.toLowerCase()
    if (value === 'true') query[key] = true
    else if (value === 'false') query[key] = false
    else if (!isNaN(value)) query[key] = Number(value)
  }
  return query
}
