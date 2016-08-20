'use strict';

// Hardcode part
const VALIDATION_GROUP = -0;

const util = require('util');
var _e;
var session = {};

function sendValidateRequest(groupinfo) {
    var req = util.format('Please validate the following link: \nGroup ID: %n\nGroup Title: %s\nInvite Link: %s', groupinfo.id, groupinfo.title, groupinfo.invite_link);
    _e.bot.sendMessage(VALIDATION_GROUP, req, {
        reply_markup: [[{text: 'Validate', callback_data: 'validate:' + groupinfo.id}, {text: 'Reject', callback_data: 'reject:' + groupinfo.id}]] // TODO
    }).then((msg) => {
        session[groupinfo.id] = groupinfo;
    })
}

function init() {
    var context = _e.libs['gpindex_common'];
    context.event.on('new_private_queue', sendValidateRequest);
}

function processCallbackButton(msg, type, bot) {
    var operator = msg.data.split(':')[0];
    var gid = msg.data.split(':')[1];
    switch (operator) {
        case 'validate':
            var is_update = session[gid].is_update;
            delete session[gid];
            _e.libs['gpindex_common'].doValidate(gid, is_update);
            bot.answerCallbackQuery(msg.id, 'Validated!');
            // send response, notify creator
            break;
        case 'reject':
            delete session[gid];
            // notify creator
    }
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