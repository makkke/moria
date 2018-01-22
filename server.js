const moment = require('moment')
const WebSocket = require('ws')
const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
)
const Table = require('easy-table')
const { nicehashApi } = require('./utils/api')

const BTC_WALLET = process.env.BTC_WALLET
const MINIMUM_PROFITABILITY = 0.0035 + 0.0035 + 0.0007 + 0.00015
const ALERT_THRESHOLD = 5 * 60 * 1000 // 5min
const UPDATE_INTERVAL = 1 * 3 * 1000 // 3sec
const NICEHASH_FETCH_INTERVAL = 1 * 60 * 1000 // 1min

const stringifyProfitabilityInBTC = profitability => `${profitability.toFixed(10)} BTC/day`
const stringifyProfitabilityInMilliBTC = profitability => `${(profitability * 1000).toFixed(7)} mBTC/day`
const stringifyBTCInMilliBTC = btc => `${(btc * 1000).toFixed(7)} mBTC`

let nicehashStats = {
  profitability: 0.0,
  balance: 0.0,
  paidAt: null,
}
const rigs = {}

const wss = new WebSocket.Server({ port: 9090, clientTracking: true })
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const { type, payload: { rig, data } } = JSON.parse(message)

    switch (type) {
      case 'CONNECTION_SUCCESS':
        console.log(`Rig ${rig.name} connected`)
        rigs[rig.name] = {
          name: rig.name,
          profitability: parseFloat(rig.profitability),
          gpus: [],
        }
        break

      case 'LOAD_SYSTEM_DATA_FAILURE':
        console.log('cant load system data')
        break

      case 'LOAD_SYSTEM_DATA_SUCCESS':
        rigs[rig.name].updatedAt = moment(data.timestamp)
        if (Array.isArray(data.gpu)) {
          rigs[rig.name].gpus = data.gpu.map(gpu => ({
            pci: gpu.pci.pci_bus,
            name: gpu.product_name,
            usage: gpu.utilization.gpu_util,
            temperature: gpu.temperature.gpu_temp,
            power: {
              draw: gpu.power_readings.power_draw,
              limit: gpu.power_readings.power_limit,
            },
            fan: gpu.fan_speed,
          }))
        } else {
          rigs[rig.name].gpus = [{
            pci: data.gpu.pci.pci_bus,
            name: data.gpu.product_name,
            usage: data.gpu.utilization.gpu_util,
            temperature: data.gpu.temperature.gpu_temp,
            power: {
              draw: data.gpu.power_readings.power_draw,
              limit: data.gpu.power_readings.power_limit,
            },
            fan: data.gpu.fan_speed,
          }]
        }
        // console.log(JSON.stringify(data, null, '\t'))
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

const fetchNicehashStats = async () => {
  const { current, payments } = await nicehashApi({
		method: 'stats.provider.ex',
		addr: BTC_WALLET,
	})

	const activeAlgorithms = current.filter(x => x.data[0].a)
	const totalProfitability = activeAlgorithms.reduce((acc, x) => acc + x.profitability * x.data[0].a, 0)

  const balance = current.reduce((acc, x) => acc + parseFloat(x.data[1]), 0.0)

  return {
    profitability: parseFloat(totalProfitability.toFixed(10)),
    balance: parseFloat(balance.toFixed(10)),
    paidAt: payments[0] ? moment(payments[0].time * 1000) : null,
  }
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
  const { balance, profitability, paidAt } = nicehashStats
  const progress = balance / MINIMUM_PROFITABILITY * 100
  const minProgress = paidAt ? moment().diff(paidAt) / 86400000 * 100 : 0
  console.log(paidAt.format())
  console.log(moment().format())
  console.log(moment().diff(paidAt))
  console.log(moment().milliseconds() - paidAt.milliseconds())

  console.log('Mining Farm: Happy Bit\n')
  let t = new Table()
  // total gpus
  t.cell('Progress', `${progress.toFixed(2)}% of ${minProgress.toFixed(2)}%`)
  t.cell('Balance', stringifyBTCInMilliBTC(balance))
  t.cell('Profitability', stringifyProfitabilityInMilliBTC(profitability))
  t.cell('Min Profitability', stringifyProfitabilityInMilliBTC(MINIMUM_PROFITABILITY))
  t.newRow()
  console.log(t.toString())
}

const printRigStats = () => {
  Object.keys(rigs).forEach(x => {
    const rig = rigs[x]

    console.log(`Rig: ${rig.name}`, rig.updatedAt ? `(${rig.updatedAt.fromNow()})` : '')

    if (rig.gpus.length) {
      const t = new Table()
      rig.gpus.forEach(gpu => {
        t.cell('PCI Port', gpu.pci)
        t.cell('GPU', gpu.name)
        t.cell('Usage', gpu.usage)
        t.cell('Temperature', gpu.temperature)
        t.cell('Power Draw', gpu.power.draw)
        t.cell('Power Limit', gpu.power.limit)
        t.cell('Fan', gpu.fan)
        t.newRow()
      })
      console.log(t.toString())
    }
  })
}

let alertThresholdStartedAt

const main = async () => {
  clearScreen()
  printFarmStats()
  printRigStats()
}

fetchNicehashStats().then(stats => nicehashStats = stats)

setInterval(main, UPDATE_INTERVAL)
setInterval(async () => {
  nicehashStats = await fetchNicehashStats()
}, NICEHASH_FETCH_INTERVAL)
