'use strict';

// Hardcode part
const VALIDATION_GROUP = -40470611;

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
    if (session[gid]) {
        switch (operator) {
            case 'validate':
                var is_update = session[gid].is_update;
                var creator = session[gid].creator;
                delete session[gid];
                _e.libs['gpindex_common'].doValidate(gid, is_update);
                bot.answerCallbackQuery(msg.id, 'Validated!');
                bot.editMessageText('Validated!', {
                    chat_id: msg.message.chat.id,
                    message_id: msg.message.message_id 
                });
                bot.sendMessage(creator, "您的群组信息已通过验证。");
                // send response, notify creator
                break;
            case 'reject':
                var creator = session[gid].creator;
                delete session[gid];
                bot.answerCallbackQuery(msg.id, 'Rejected!');
                bot.editMessageText('Rejected!', {
                    chat_id: msg.message.chat.id,
                    message_id: msg.message.message_id 
                });
                bot.sendMessage(creator, "您的群组信息未通过验证。请重试。");
                // notify creator
        }
    } else {
        bot.answerCallbackQuery(msg.id, 'Session Outdated!');
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