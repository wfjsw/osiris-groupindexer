var _e, comlib
const admin_id = require('../config.gpindex.json')['gpindex_admin'];
const util = require('util')
const express = require('express')
var bodyParser = require('body-parser')
var app = express()

const keyword = ['halal', '阿三', '天城文', '阿拉伯']

app.use(bodyParser.urlencoded({
    extended: true
}))

async function upstreamUnban(id) {
    await comlib.UserFlag.setUserFlag(parseInt(id), 'block', 0)
    await comlib.UserFlag.setUserFlag(parseInt(id), 'spam', 0)
    return await _e.bot.sendMessage(admin_id, `${id} status: unbanned by upstream`)
}

async function halalBan(id) {
    const result1 = await comlib.UserFlag.setUserFlag(parseInt(id), 'block', 1)
    const result2 = await comlib.UserFlag.setUserFlag(parseInt(id), 'spam', Math.floor(new Date().valueOf() / 1000) + 3 * 365 * 24 * 3600)
    return await _e.bot.sendMessage(admin_id, `${id} status: block=1 spam=P3Y (halal match)\n\n${util.inspect(result1)}\n${util.inspect(result2)}`)
}

app.post('/addFlag/block', function (req, res) {
    if (!req.body) return res.sendStatus(400)
    if (req.body.ban == 'false') {
        upstreamUnban(req.body.id)
        return res.sendStatus(200)
    }
    const keyword_match = keyword.some(kw => {
        return req.body.reason.toLowerCase().indexOf(kw) > -1
    })
    if (keyword_match && parseInt(req.body.expires) == 0) {
        halalBan(req.body.id)
        return res.sendStatus(200)
    } else {
        comlib.UserFlag.setUserFlag(parseInt(req.body.id), 'block', 1)
            .then((ret) => {
                _e.bot.sendMessage(admin_id, `${req.body.id} status: block=1\n\n${util.inspect(ret)}`)
                return res.sendStatus(200)
            })
    }

})

app.listen(41003)

module.exports = {
    init: e => {
        _e = e
        comlib = _e.libs['gpindex_common']
    }
}
