const fetch = require('node-fetch')
const qs = require('querystring')
const urljoin = require('url-join')

const api = async (uri, options = {}) => {
  const { method = 'GET', body, headers, query } = options
  const url = query ? `${uri}?${qs.stringify(query)}` : uri

  const response = await fetch(url, {
    headers: {
      ...headers,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = new Error(response.statusText)
    error.response = response
    throw error
  }

  const { result } = await response.json()

  if (result.error) {
    const error = new Error(result.error)
    throw error
  }

  return result
}

const nicehashApi = (params = {}) => {
  const url = 'https://api.nicehash.com/api'
  const options = { query: params }

  return api(url, options)
}

module.exports = {
  nicehashApi,
}
