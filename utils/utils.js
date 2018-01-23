const colors = require('colors')
const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
)

const percentage = x => `${x.toFixed(0)}%`

const formatCurrentProgress = (current, minimum) => {
  let color = colors.green

  if (current < minimum - 5) {
    color = colors.red
  } else if (current < minimum) {
    color = colors.yellow
  }

  return color(percentage(current))
}

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
  clocks: {
    graphics: { current: data.clocks.graphics_clock, max: data.max_clocks.graphics_clock },
    memory: { current: data.clocks.mem_clock, max: data.max_clocks.mem_clock },
    video: { current: data.clocks.video_clock, max: data.max_clocks.video_clock },
  },
})

const clearScreen = () => {
  const readline = require('readline')
  const blank = '\n'.repeat(process.stdout.rows)
  console.log(blank)
  readline.cursorTo(process.stdout, 0, 0)
  readline.clearScreenDown(process.stdout)
}

const sendSms = message => (
  twilio.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: process.env.PHONE_NUMBER,
    body: message,
  })
)

module.exports = {
  percentage,
  formatCurrentProgress,
  mapDataToRig,
  clearScreen,
  sendSms,
}
