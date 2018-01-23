const qs = require('querystring')
const colors = require('colors')
const request = require('request-promise')
const cheerio = require('cheerio')
const Table = require('easy-table')

const { clearScreen } = require('./utils/utils')

const UPDATE_INTERVAL = 1 * 5 * 1000 // 5sec
const DATA_FETCH_INTERVAL = 1 * 10 * 1000 // 1min

const gpusToSearch = [
  '1080 ti',
  '1080',
  // '1070 ti',
  // '1070',
  // '1060',
  // '1050 ti',
  // '1050',
]
let availableGPUs = []

const r = request.defaults({
  transform: body => cheerio.load(body)
})

const fetchAvailableGPU = async (name) => {
  const baseUrl = 'https://www.newegg.ca/Product/ProductList.aspx'
  const query = {
    Submit: 'ENE',
    DEPA: 0,
    Order: 'BESTMATCH',
    N: -1,
    NodeId: 1,
    Description: name,
  }
  const url = `${baseUrl}?${qs.stringify(query)}`
  console.log(url)
  try {
    const $ = await r(url)
    let gpus = []
    $('.item-container').each(function(i, elem) {
      console.log(i)
      const buttonText = $(this).find('.item-button-area button').text().trim()
      console.log(buttonText)
      if (buttonText === 'Add To Cart') {
        console.log('found')
        const name = $(this).find('.item-title').text()
        let shortName = name.substring(0, name.indexOf('DirectX'))
        if (name.includes(',')) {
          shortName = name.substring(0, name.indexOf(','))
        }
        const price = parseInt($(this).find('.price-current strong').text().replace(',', ''), 10)

        gpus.push({ name: shortName, price })
      }
    })

    return gpus
  } catch (err) {
    console.log(err)
  }
}

const fetchAvailableGPUs = async () => {
  try {
    const promises = gpusToSearch.map(x => fetchAvailableGPU(x))
    const arr = await Promise.all(promises)
    console.log(arr)
    return arr.reduce((acc, x) => [...acc, ...x], [])
  } catch (err) {
    console.log(err)
  }

  return []
}

const printAvailableGPUs = async () => {
  console.log('Goblin - The GPU Seeker\n'.bold.underline)

  let t = new Table()
  availableGPUs.forEach(x => {
    t.cell('Vendor', 'Newegg.ca')
    t.cell('GPU', x.name)
    t.cell('Price', `$${x.price}`)
    t.newRow()
  })
  console.log(t.toString())
}

const main = async () => {
  clearScreen()
  printAvailableGPUs()
}

fetchAvailableGPUs().then(gpus => availableGPUs = gpus)

setInterval(main, UPDATE_INTERVAL)
setInterval(async () => {
  availableGPUs = await fetchAvailableGPUs()
}, DATA_FETCH_INTERVAL)
