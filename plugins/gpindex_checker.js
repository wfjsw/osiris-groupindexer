'use strict';

// Hardcode part
const VALIDATION_GROUP = require('../config.json')['gpindex_admin'];

const util = require('util');

var alt_bot = new (require('../libtelegrambot'))(require('../config.json')["api-key"])

var _e;
var session = {};

function sendValidateRequest(groupinfo) {
    if (!groupinfo.is_update) {
        var req = util.format('Please validate the following link: \nGroup ID: %s\nGroup Title: %s\nInvite Link: %s\nTag: %s\nCreator: %s\nDesc: %s\n', groupinfo.id, groupinfo.title, groupinfo.invite_link, groupinfo.tag, groupinfo.creator, groupinfo.desc);
        _e.bot.sendMessage(VALIDATION_GROUP, req, {
            reply_markup: {inline_keyboard:[[{text: 'Validate', callback_data: 'validate:' + groupinfo.id}, {text: 'Reject', callback_data: 'reject:' + groupinfo.id}]]} // TODO
        }).then((msg) => {
            session[groupinfo.id] = groupinfo;
        }).catch((e) => {
            _e.bot.sendMessage(VALIDATION_GROUP, 'Err: \n' + util.inspect(e));
        });
    } else {
        _e.libs['gpindex_common'].getRecord(groupinfo.id)
        .then((ret) => {
            var req = util.format('Please validate the following link: \nGroup ID: %s\nGroup Title: %s\nInvite Link: %s\nTag: %sCreator: %s\nDesc: %s\n\nUpdation: ', ret.id, ret.title, ret.invite_link, ret.tag, ret.creator, ret.desc, util.inspect(groupinfo));
            _e.bot.sendMessage(VALIDATION_GROUP, req, {
                reply_markup: {inline_keyboard:[[{text: 'Validate', callback_data: 'validate:' + groupinfo.id}, {text: 'Reject', callback_data: 'reject:' + groupinfo.id}]]} // TODO
            })
        })
        .then((msg) => {
            session[groupinfo.id] = groupinfo;
        }).catch((e) => {
            _e.bot.sendMessage(VALIDATION_GROUP, 'Err: \n' + util.inspect(e));
        });
    }
}

function init() {
    var context = _e.libs['gpindex_common'];
    context.event.on('new_private_queue', sendValidateRequest);
    context.event.on('group_removal', processOptOut);
}

function processOptOut(chatid) {
	alt_bot.getChat(chatid)
	.then((info) => {
	    _e.bot.sendMessage(VALIDATION_GROUP, 'Proceed Removal\n' + util.inspect(info))
	})
	.catch((e) => {
		_e.bot.sendMessage(VALIDATION_GROUP, 'Err: \n' + util.inspect(e));
	})
}

function processCallbackButton(msg, type, bot) {
    var operator = msg.data.split(':')[0];
    var gid = msg.data.split(':')[1];
    if (operator == 'validate' || operator == 'reject')
    if (session[gid]) {
        switch (operator) {
            case 'validate':
                var is_update = session[gid].is_update;
                var creator = session[gid].creator;
                delete session[gid];
                _e.libs['gpindex_common'].doValidate(gid, is_update);
                bot.answerCallbackQuery(msg.id, 'Validated!');
                bot.editMessageText('Validated by ' + msg.from.first_name + ' ' + msg.from.last_name, {
                    chat_id: msg.message.chat.id,
                    message_id: msg.message.message_id 
                });
                if (is_update) bot.sendMessage(gid, "您的群组信息已通过验证。")
                else bot.sendMessage(creator, "您的群组信息已通过验证。");
                // send response, notify creator
                break;
            case 'reject':
                var is_update = session[gid].is_update;
                var creator = session[gid].creator;
                delete session[gid];
                bot.answerCallbackQuery(msg.id, 'Rejected!');
                bot.editMessageText('Rejected by ' + msg.from.first_name + ' ' + msg.from.last_name, {
                    chat_id: msg.message.chat.id,
                    message_id: msg.message.message_id 
                });
                if (is_update) bot.sendMessage(gid, "您的群组信息未通过验证。请重试。");
                else bot.sendMessage(creator, "您的群组信息未通过验证。请重试。");
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
