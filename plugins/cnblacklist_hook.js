'use strict';

var _e, comlib
const admin_id = require('../config.gpindex.json')['gpindex_admin'];
const util = require('util')
const express = require('express')
var bodyParser = require('body-parser')
var app = express()

app.use(bodyParser.urlencoded({ extended: true }))

app.post('/addFlag/block', function (req, res) {
    if (!req.body) return res.sendStatus(400)
    if (req.body.ban == false) return res.sendStatus(200)
    comlib.UserFlag.setUserFlag(parseInt(req.body.id), 'block', 1)
    .then((ret) => {
        _e.bot.sendMessage(admin_id, `${req.body.id} status: block=1\n\n${util.inspect(ret)}`)
        res.sendStatus(200)
    })
})

app.listen(41003)

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
    },
    run: [
    ]
}
