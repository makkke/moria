const colors = require('colors')
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

const mapDataToRig = (data) => ({
  pci: data.pci.pci_bus,
  name: data.product_name,
  usage: data.utilization.gpu_util,
  temperature: data.temperature.gpu_temp,
  power: {
    draw: data.power_readings.power_draw,
    limit: data.power_readings.power_limit,
  },
  fan: data.fan_speed,
})

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
          rigs[rig.name].gpus = data.gpu.map(mapDataToRig)
        } else {
          rigs[rig.name].gpus = [mapDataToRig(data.gpu)]
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

  console.log('Mining Farm: Happy Bit\n'.bold.underline)
  let t = new Table()
  // total gpus
  t.cell('Progress', (progress < minProgress ? `${parseInt(progress, 10)}%`.red : `${parseInt(progress, 10)}%`.green) + ` of ${parseInt(minProgress, 10)}%`)
  t.cell('Balance', stringifyBTCInMilliBTC(balance))
  t.cell('Profitability', profitability < MINIMUM_PROFITABILITY ? stringifyProfitabilityInMilliBTC(profitability).red : stringifyProfitabilityInMilliBTC(profitability).green)
  t.cell('Min Profitability', stringifyProfitabilityInMilliBTC(MINIMUM_PROFITABILITY))
  t.newRow()
  console.log(t.toString())
  console.log()
}

const printRigStats = () => {
  Object.keys(rigs).forEach(x => {
    const rig = rigs[x]

    console.log(`Rig: ${rig.name}`.bold, rig.updatedAt ? `(${rig.updatedAt.fromNow()})`.bold : '')
    console.log()

    if (rig.gpus.length) {
      const t = new Table()
      rig.gpus.forEach(gpu => {
        t.cell('PCI', gpu.pci)
        t.cell('GPU', gpu.name)
        t.cell('Usage', parseInt(gpu.usage, 10) < 90 ? gpu.usage.red : parseInt(gpu.usage, 10) < 95 ? gpu.usage.yellow : gpu.usage.green)
        t.cell('Temperature', parseInt(gpu.temperature, 10) > 75 ? gpu.temperature.red : parseInt(gpu.temperature, 10) > 60 ? gpu.temperature.yellow : gpu.temperature.green)
        t.cell('Power Draw', parseInt(gpu.power.draw, 10) > parseInt(gpu.power.limit, 10) ? gpu.power.draw.red : gpu.power.draw)
        t.cell('Power Limit', gpu.power.limit)
        t.cell('Fan', parseInt(gpu.fan, 10) > 75 ? gpu.fan.red : parseInt(gpu.fan, 10) > 50 ? gpu.fan.yellow : gpu.fan)
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
