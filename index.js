const fs = require('fs');
const express = require('express')
const app = express()
const port = +process.argv[2] || 3000

const cards = JSON.parse(fs.readFileSync('./cards.json'));
const lastSend = Date.now()

let msgQueue = []
let isThereATimeout = false

const client = require('redis').createClient()
client.on('error', (err) => console.log('Redis Client Error', err));

async function redisIncrAll() {
    if (msgQueue.length < 1){
        setImmediate(() => redisIncrAll())
        return
    }

    var curMsgQueue = msgQueue;
    msgQueue = []

    var pipe = client.multi();
    curMsgQueue.forEach((msg, idx) => {
        pipe.incr(msg.id);
    })

    pipe.exec().then((data) => {
        data.forEach((cardInd, idx) => {
            if (cardInd > cards.length)
                curMsgQueue[idx].res.send({id: 'ALL CARDS'})
            else
                curMsgQueue[idx].res.send(cards[cardInd])
        })
    })
    
    setImmediate(() => redisIncrAll())
}

client.on('ready', () => {
    setTimeout(() => redisIncrAll(), 2)
    app.listen(port, '0.0.0.0', () => {})
})

// each n requests or x time send to redis
app.get('/card_add', async (req, res) => {
    const key = 'u:' + req.query.id
    msgQueue.push({id: key, res:res});
})

app.get('/ready', async (req, res) => {
    res.send({ready: true})
})

client.connect();
