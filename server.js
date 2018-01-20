const WebSocket = require('ws')
const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
)
const Table = require('easy-table')
const { nicehashApi } = require('./utils/api')

const BTC_WALLET = process.env.BTC_WALLET
const ALERT_THRESHOLD = 5 * 60 * 1000 // 5min
const UPDATE_INTERVAL = 1 * 3 * 1000 // 3sec
const NICEHASH_UPDATE_INTERVAL = 1 * 60 * 1000 // 1min

const stringifyProfitabilityInBTC = profitability => `${profitability.toFixed(10)} BTC/day`
const stringifyProfitabilityInMilliBTC = profitability => `${(profitability * 1000).toFixed(7)} mBTC/day`
const stringifyProfitability = stringifyProfitabilityInMilliBTC

let profitability = 0.0
const rigs = {}

const wss = new WebSocket.Server({ port: 9090 })
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const { type, payload: { rig, data } } = JSON.parse(message)

    switch (type) {
      case 'CONNECTION_SUCCESS':
        console.log(`Rig ${rig.name} connected`)
        rigs[rig.name] = {
          ...rig,
          gpus: [],
        }
        break

      case 'LOAD_SYSTEM_DATA_FAILURE':
        console.log('cant load system data')
        break

      case 'LOAD_SYSTEM_DATA_SUCCESS':
        rigs[rig.name].gpus = [{
          name: data.gpu.product_name,
          usage: data.gpu.utilization.gpu_util,
          temperature: data.gpu.temperature.gpu_temp,
          power: data.gpu.power_readings.power_draw,
        }]
        // console.log(JSON.stringify(payload, null, '\t'))
        break

      default:
        console.log('unknow message')
    }
  })
})

const clearScreen = () => {
  const readline = require('readline')
  const blank = '\n'.repeat(process.stdout.rows)
  console.log(blank)
  readline.cursorTo(process.stdout, 0, 0)
  readline.clearScreenDown(process.stdout)
}

const calcProfitability = async () => {
  const { current } = await nicehashApi({
		method: 'stats.provider.ex',
		addr: BTC_WALLET
	})

	const activeAlgorithms = current.filter(x => x.data[0].a)
	const totalProfitability = activeAlgorithms.reduce((acc, x) => acc + x.profitability * x.data[0].a, 0)

  return parseFloat(totalProfitability.toFixed(10))
}

const calcMinimumProfitability = () => {
  return Object.keys(rigs).reduce((acc, x) => acc + rigs[x].profitability, 0.0)
}

const sendSms = message => (
  twilio.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: process.env.PHONE_NUMBER,
    body: message,
  })
)

const printFarmStats = () => {
  const minimumProfitability = calcMinimumProfitability()

  console.log('Mining Farm: Happy Bit')
  let t = new Table()
  // total gpus
  t.cell('Profitability', stringifyProfitabilityInMilliBTC(profitability))
  t.cell('Min Profitability', stringifyProfitabilityInMilliBTC(minimumProfitability))
  // t.cell('Price, USD', product.price, Table.number(2))
  t.newRow()
  console.log(t.toString())
}

let alertThresholdStartedAt

const main = async () => {
  clearScreen()
  printFarmStats()

  const minimumProfitability = calcMinimumProfitability()

  // profitability
  // try {
  //   // totalProfitability += profitability
  //   // const averageProfitability = totalProfitability / counter
  //
	// 	if (!profitability) {
  //     const message = 'ZHOPA! No miners are working!'
  //     // sendSms(message)
  //
  //     console.log('ZHOPA! No miners are working!')
	// 		return
	// 	}
  //
	// 	if (profitability < minimumProfitability) {
  //     const message = `ZHOPA! Farm profitability is LOW! ${stringifyProfitability(profitability)} of ${stringifyProfitability(MIN_PROFITABILITY_IN_BTC)}`
  //
  //     alertThresholdStartedAt = alertThresholdStartedAt || Date.now()
  //     if (Date.now() - alertThresholdStartedAt > ALERT_THRESHOLD) {
  //       sendSms(message)
  //       alertThresholdStartedAt = null
  //     }
  //
  //     console.log(message)
	// 		return
	// 	}
  //
  //   alertThresholdStartedAt = null
	// 	// console.log('Farm profitability:', stringifyProfitability(profitability), ', average:', stringifyProfitability(averageProfitability))
	// } catch (err) {
	// 	console.error(err)
	// }

  // status
  Object.keys(rigs).forEach(x => {
    const rig = rigs[x]

    console.log(`Rig: ${rig.name}`)

    if (rig.gpus.length) {
      const t = new Table()
      rig.gpus.forEach(gpu => {
        t.cell('GPU', gpu.name)
        t.cell('Usage', gpu.usage)
        t.cell('Temperature', gpu.temperature)
        t.cell('Power', gpu.power)
        // t.cell('Price, USD', product.price, Table.number(2))
        t.newRow()
      })
      console.log(t.toString())
    }
  })
}

setInterval(main, UPDATE_INTERVAL)
setInterval(async () => {
  profitability = await calcProfitability()
}, NICEHASH_UPDATE_INTERVAL)
