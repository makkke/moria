const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 8080 })

wss.on('connection', connection(ws) => {
  ws.on('message', incoming(message) => {
    console.log('received: %s', message)
  })
  //
  // ws.send('something')
})
