'use strict'; 
var _e;

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
        }).catch((e) => {
            // I hate error. Just eat it.
        })
    }
}

module.exports = {
    init: (e) => {
        _e = e;
    },
    preprocess: passiveUpdate
}
