const fs = require('fs');
const turbo = require('turbo-http')

const port = +process.argv[2] || 3000

let cards = JSON.parse(fs.readFileSync('./cards.json'));
cards.forEach((elem, idx) => {
    cards[idx] = Buffer.from('{"id":"' + elem.id + '","name":"' + elem.name + '"}')
})

let msgQueue = []

allBuf = Buffer.from('{"id": "ALL CARDS", "name": ""}')
readyBuf = Buffer.from('{"ready": true}')
prefixLen = '/card_add?id='.length

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
            if (cardInd > cards.length) {
                curMsgQueue[idx].res.setHeader('Content-Length', allBuf.length)
                curMsgQueue[idx].res.write(allBuf)
            } else {
                curMsgQueue[idx].res.setHeader('Content-Length', cards[cardInd-1].length)
                curMsgQueue[idx].res.write(cards[cardInd-1])
            }
        })
    })
    
    setImmediate(() => redisIncrAll())
}

const app = turbo.createServer(function (req, res) {
    if (req.url[1] == 'c') { // add_card
        msgQueue.push({id: req.url.substr(prefixLen), res:res});
    } else { // ready
        res.setHeader('Content-Length', readyBuf.length)
        res.write(readyBuf)
    }
})

const client = require('redis').createClient()
// client.on('error', (err) => console.log('Redis Client Error', err));

client.on('ready', () => {
    setTimeout(() => redisIncrAll(), 2)
    app.listen(port)
})

client.connect();
