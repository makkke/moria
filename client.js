const WebSocket = require('ws')
const smi = require('node-nvidia-smi')

smi((err, data) => {
  // handle errors
  if (err) {
    console.warn(err);
    process.exit(1);
  }

  // display GPU information
  console.log(JSON.stringify(data, null, ' '))
})

// const ws = new WebSocket('ws://192.168.86.26:8080')
//
// ws.on('open', function open() {
//   console.info('connected to farm: ws://192.168.86.26:8080')
//   ws.send({ type: 'connected' })
// })
//
// ws.on('message', incoming(data) => {
//   console.log(data)
// })
