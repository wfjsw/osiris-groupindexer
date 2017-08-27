const VALIDATION_GROUP = require('../config.gpindex.json')['gpindex_admin'];
const util = require('util');

var _e;
var session = {};

async function sendValidateRequest(groupinfo) {
    if (!groupinfo.is_update) {
        try {
            var req = `Please validate the following link: \nGroup ID: ${groupinfo.id}\nGroup Title: ${groupinfo.title}\nInvite Link: ${groupinfo.invite_link}\nTag: ${groupinfo.tag}\nCreator: ${groupinfo.creator}\nDesc: ${groupinfo.desc}\n`
            await _e.bot.sendMessage(VALIDATION_GROUP, req, {
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: 'Validate',
                            callback_data: 'validate:' + groupinfo.id
                        }, {
                            text: 'Silent',
                            callback_data: 'silent-pass:' + groupinfo.id
                        }, {
                            text: 'Reject',
                            callback_data: 'reject:' + groupinfo.id
                        }]
                    ]
                },
                disable_web_page_preview: true
            })
            session[groupinfo.id] = groupinfo
            return
        } catch (e) {
            return _e.bot.sendMessage(VALIDATION_GROUP, 'Err: \n' + util.inspect(e.stack));
        }
    } else {
        try {
            const record = await _e.libs['gpindex_common'].getRecord(groupinfo.id)
            var req = `Please validate the following link: \nGroup ID: ${record.id}\nGroup Title: ${record.title}\nInvite Link: ${record.invite_link}\nTag: ${record.tag}\nCreator: ${record.creator}\nDesc: ${record.desc}\n\nUpdation: ${util.inspect(Object.assign(session[groupinfo.id] || {}, groupinfo))}`
            await _e.bot.sendMessage(VALIDATION_GROUP, req, {
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: 'Validate',
                            callback_data: 'validate:' + groupinfo.id
                        }, {
                            text: 'Silent',
                            callback_data: 'silent-pass:' + groupinfo.id
                        }, {
                            text: 'Reject',
                            callback_data: 'reject:' + groupinfo.id
                        }]
                    ]
                },
                disable_web_page_preview: true
            })
            session[groupinfo.id] = Object.assign(session[groupinfo.id] | {}, groupinfo)
            return true
        } catch (e) {
            return _e.bot.sendMessage(VALIDATION_GROUP, 'Err: \n' + util.inspect(e.stack));
        }
    }
}

function init() {
    var context = _e.libs['gpindex_common'];
    context.event.on('new_private_queue', sendValidateRequest);
    context.event.on('group_removal', processOptOut);
}

async function processOptOut(chatid) {
    try {
        const info = await _e.bot.getChat(chatid)
        return _e.bot.sendMessage(VALIDATION_GROUP, 'Proceed Removal\n' + util.inspect(info))
    } catch (e) {
        return _e.bot.sendMessage(VALIDATION_GROUP, 'Err: \n' + util.inspect(e.stack))
    }
}

function processCallbackButton(msg, type, bot) {
    if (msg.message.chat.id != VALIDATION_GROUP) return
    var [operator, gid] = msg.data.split(':')
    const valid_operator = ['validate', 'silent-pass', 'reject']
    if (session[gid] && valid_operator.indexOf(operator) > -1) {
        switch (operator) {
            case 'validate':
                var is_silent = false
                var is_update = session[gid].is_update;
                var creator = session[gid].creator;
                delete session[gid];
                _e.libs['gpindex_common'].doValidate(gid, is_update, is_silent);
                bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: 'Validated!'
                });
                bot.editMessageText(`${msg.message.text}\n\n✅Validated by ${msg.from.first_name} ${msg.from.last_name}`, {
                    chat_id: msg.message.chat.id,
                    message_id: msg.message.message_id,
                    disable_web_page_preview: true
                });
                if (is_update) bot.sendMessage(gid, "您的群组信息已通过验证。")
                else bot.sendMessage(creator, "您的群组信息已通过验证。");
                // send response, notify creator
                break;
            case 'silent-pass':
                var is_silent = true
                var is_update = session[gid].is_update;
                var creator = session[gid].creator;
                delete session[gid];
                _e.libs['gpindex_common'].doValidate(gid, is_update, is_silent);
                bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: 'Validated!'
                });
                bot.editMessageText(`${msg.message.text}\n\n✅Validated(silent) by ${msg.from.first_name} ${msg.from.last_name}`, {
                    chat_id: msg.message.chat.id,
                    message_id: msg.message.message_id,
                    disable_web_page_preview: true
                });
                if (is_update) bot.sendMessage(gid, "您的群组信息已通过验证。")
                else bot.sendMessage(creator, "您的群组信息已通过验证。");
                // send response, notify creator
                break;
            case 'reject':
                var is_update = session[gid].is_update;
                var creator = session[gid].creator;
                delete session[gid];
                bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: 'Rejected!'
                });
                bot.editMessageText(`${msg.message.text}\n\n❎Rejected by ${msg.from.first_name} ${msg.from.last_name}`, {
                    chat_id: msg.message.chat.id,
                    message_id: msg.message.message_id,
                    disable_web_page_preview: true
                });
                if (is_update) bot.sendMessage(gid, "您的群组信息未通过验证。请重试。");
                else bot.sendMessage(creator, "您的群组信息未通过验证。请重试。");
        }
    } else if (valid_operator.indexOf(operator) > -1) {
        bot.answerCallbackQuery({
            callback_query_id: msg.id,
            text: 'Session Outdated!'
        });
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
