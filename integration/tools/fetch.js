const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))
// TODO: remove this once fetch is available in Node

function buildPostOpts(json) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json)
  }
}

async function callFetch(url, fetchOpts = {}) {
  console.log(`Calling fetch. URL: ${url}, Options: ${JSON.stringify(fetchOpts)}`)
  const response = await fetch(url, fetchOpts)
  if (!response.ok) {
    const { status, statusText } = response
    throw new Error(`Error fetching ${url}: ${status}, ${statusText}`)
  }
  return response
}
module.exports = { callFetch, buildPostOpts }
