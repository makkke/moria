const WebSocket = require('ws')
const smi = require('node-nvidia-smi')

const UPDATE_INTERVAL = 5 * 1000 // 5sec

const rig = {
  name: process.env.RIG_NAME,
  profitability: process.env.RIG_PROFITABILITY,
}

const ws = new WebSocket('ws://77e3e5f8.ngrok.io')
ws.on('open', () => {
  console.info('connected to farm')
  ws.send(JSON.stringify({ type: 'CONNECTION_SUCCESS', payload: { rig } }))

  setInterval(() => {
    // get system data
    smi((err, data) => {
      if (err) {
        ws.send(JSON.stringify({ type: 'LOAD_SYSTEM_DATA_FAILURE', payload: { rig, err } }))
        console.warn(err)
      }

      ws.send(JSON.stringify({ type: 'LOAD_SYSTEM_DATA_SUCCESS', payload: { rig, data: data.nvidia_smi_log }}))
    })
  }, UPDATE_INTERVAL)
})

ws.on('message', (data) => {
  console.log(data)
})
