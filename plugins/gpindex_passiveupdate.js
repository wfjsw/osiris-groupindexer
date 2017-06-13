'use strict'; 
var _e, _ga

const ADMIN_GROUP = require('../config.json')['gpindex_admin'];

function passiveUpdate(msg, bot) {
    if (msg.chat.id < 0) {
        var gid = msg.chat.id
        _e.libs['gpindex_common'].getRecord(gid)
        .then((ret) => {
            var updation, updatable;
            if (ret && ret.title != msg.chat.title) {
                updation.title = msg.chat.title;
                updatable = true;
            }
            if (ret && ret.username && ret.username != msg.chat.username) {
                updation.username = msg.chat.username;
                updatable = true
            }
            if (updatable == true) return _e.libs['gpindex_common'].silentUpdate(gid, updation);
        }).then((ret) => {
            _ga.tEvent(gid, 'passiveUpdate', 'updated')
        }).catch((e) => {
            console.error(e)
            _ga.tException(gid, e.description, false)
        })
    }
}

module.exports = {
    init: (e) => {
        _e = e;
        _ga = e.libs['ga'];
    },
    preprocess: passiveUpdate
}
