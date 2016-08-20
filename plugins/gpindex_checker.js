'use strict';

// Hardcode part
const VALIDATION_GROUP = -0;

const util = require('util');
var _e;

function sendValidateRequest(groupinfo) {
    var req = util.format('Please validate the following link: \nGroup ID: %n\nGroup Title: %s\nInvite Link: %s', groupinfo.id, groupinfo.title, groupinfo.invite_link);
    _e.bot.sendMessage(VALIDATION_GROUP, req, {
        reply_markup: [[{text: 'Validated', callback_data: 'validate'}]] // TODO
    })
}

function init() {
    var context = _e.libs['gpindex_common'];
    context.event.on('new_private_queue', sendValidateRequest);
}

module.exports = {
    init: (e) => {
        _e = e;
        init();
    },
    run: [
        ['callback_query', processCallbackButton]
    ]
}