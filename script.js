const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
)

const { nicehashApi } = require('./utils/api')

const BTC_WALLET = process.env.BTC_WALLET
const MIN_PROFITABILITY_IN_BTC = [0.003, 0.003, 0.0006, 0.0002].reduce((acc, x) => acc + x)
const ALERT_THRESHOLD = 5 * 60 * 1000 // 5min
const UPDATE_INTERVAL = 1 * 60 * 1000 // 1min

const stringifyProfitabilityInBTC = profitability => `${profitability.toFixed(10)} BTC/day`
const stringifyProfitabilityInMilliBTC = profitability => `${(profitability * 1000).toFixed(7)} mBTC/day`
const stringifyProfitability = stringifyProfitabilityInMilliBTC

const calcProfitability = async () => {
  const { current } = await nicehashApi({
		method: 'stats.provider.ex',
		addr: BTC_WALLET
	})

	const activeAlgorithms = current.filter(x => x.data[0].a)
	const totalProfitability = activeAlgorithms.reduce((acc, x) => acc + x.profitability * x.data[0].a, 0)

  return parseFloat(totalProfitability.toFixed(10))
}

const sendSms = message => (
  twilio.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: process.env.PHONE_NUMBER,
    body: message,
  })
)

let alertThresholdStartedAt
let totalProfitability = 0.0
let counter = 0.0

const main = async () => {
  counter++

  try {
		const profitability = await calcProfitability()
    totalProfitability += profitability
    const averageProfitability = totalProfitability / counter

		if (!profitability) {
      const message = 'ZHOPA! No miners are working!'
      sendSms(message)

      console.log('ZHOPA! No miners are working!')
			return
		}

		if (profitability < MIN_PROFITABILITY_IN_BTC) {
      const message = `ZHOPA! Farm profitability is LOW! ${stringifyProfitability(profitability)} of ${stringifyProfitability(MIN_PROFITABILITY_IN_BTC)}`

      alertThresholdStartedAt = alertThresholdStartedAt || Date.now()
      if (Date.now() - alertThresholdStartedAt > ALERT_THRESHOLD) {
        sendSms(message)
        alertThresholdStartedAt = null
      }

      console.log(message)
			return
		}

    alertThresholdStartedAt = null
		console.log('Farm profitability:', stringifyProfitability(profitability), ', average:', stringifyProfitability(averageProfitability))
	} catch (err) {
		console.error(err)
	}
}

main()
setInterval(main, UPDATE_INTERVAL)
