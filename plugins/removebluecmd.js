'use strict';

var comlib

async function removeCmd(msg, result, bot) {
    if (msg.chat.id < 0) {
        const record = await comlib.getRecord(msg.chat.id)
        const is_enabled = !(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:noblue_disabled'))
        if (record && is_enabled)
            setTimeout(() => {
                bot.deleteMessage(msg.chat.id, msg.message_id)
                    .catch(() => {})
            }, 5 * 1000)
    }
}

module.exports = {
    init: (e) => {
        comlib = e.libs['gpindex_common'];
    },
    run: [
        [/^\/[0-9a-zA-Z_@]{1,}/, removeCmd],
    ]
}
