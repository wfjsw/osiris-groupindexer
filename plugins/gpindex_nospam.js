'use strict';

const moment = require('moment');
var _e, comlib, _ga

function processSpamCheck(msg, bot) {
    const user = msg.new_chat_member ? msg.new_chat_member : msg.from
    const uid = user.id
    comlib.UserFlag.queryUserFlag(msg.from.id, 'spam')
        .then((ret) => {
            if (ret != 0 && moment().isSameOrBefore(moment.unix(ret))) {
                var bannedtime = moment.unix(ret).toNow(true)
                bot.kickChatMember(msg.chat.id, uid, ret)
                .then((ret) => {
                    _e.bot.sendMessage(msg.chat.id, '#ISSPAM #ENFORCED 已检测到并尝试移除已知群发广告用户。\n\n封禁解除时间：' + bannedtime, {
                        reply_to_message_id: msg.message_id
                    })
                    _ga.tEvent(user, 'noSpam', 'noSpam.kicked')
                }) 
                .catch((ret) => {
                    _e.bot.sendMessage(msg.chat.id, '#ISSPAM 已检测到已知群发广告用户。如需自动移除，请将机器人设置为管理员。\n\n封禁解除时间：' + bannedtime, {
                        reply_to_message_id: msg.message_id
                    })
                    _ga.tEvent(user, 'noSpam', 'noSpam.not-kicked')
                })
            } else if (ret != 0) {
                comlib.UserFlag.setUserFlag(uid, 'spam', 0);
                _ga.tEvent(user, 'noSpam', 'noSpam.expired')
            }
        });
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    preprocess: processSpamCheck
}
