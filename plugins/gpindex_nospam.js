'use strict';

const moment = require('moment');
var alt_bot = new (require('../libtelegrambot'))(require('../config.json')["api-key"])
var _e, comlib, _ga

function processSpamCheck(msg, type, bot) {
    comlib.UserFlag.queryUserFlag(msg.new_chat_member.id, 'spam')
        .then((ret) => {
            if (ret != 0 && moment().isSameOrBefore(moment.unix(ret))) {
                alt_bot.kickChatMember(msg.chat.id, msg.new_chat_member.id)
                .then((ret) => {
                    _e.bot.sendMessage(msg.chat.id, '#ISSPAM #ENFORCED 已检测到并尝试移除已知群发广告用户。', {
                        reply_to_message_id: msg.message_id
                    })
                    _ga.tEvent(msg.new_chat_member.id, 'noSpam', 'kicked', msg.chat.id)
                }) 
                .catch((ret) => {
                    _e.bot.sendMessage(msg.chat.id, '#ISSPAM 已检测到已知群发广告用户。如需自动移除，请将机器人设置为管理员。', {
                        reply_to_message_id: msg.message_id
                    })
                    _ga.tEvent(msg.new_chat_member.id, 'noSpam', 'not-kicked', msg.chat.id)
                })
            } else if (ret != 0) {
                comlib.UserFlag.setUserFlag(msg.new_chat_member.id, 'spam', 0);
                _ga.tEvent(msg.new_chat_member.id, 'noSpam', 'expired')
            }
        });
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    run: [
        ['new_chat_member', processSpamCheck]
    ]
}
