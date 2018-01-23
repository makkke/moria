const colors = require('colors')

const percentage = x => `${x.toFixed(0)}%`

const formatCurrentProgress = (current, minimum) => {
  let color = colors.green

  if (current < minimum * 0.95) {
    color = colors.red
  } else if (current < minimum) {
    color = colors.yellow
  }

  return color(percentage(current))
}

module.exports = {
  percentage,
  formatCurrentProgress,
}
