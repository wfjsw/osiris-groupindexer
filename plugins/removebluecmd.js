'use strict';

var comlib

async function removeCmd(msg, result, bot) {
    if (msg.chat.id < 0) {
        if (!msg.entities) return
        const is_cmd_exist = msg.entities.some(entity => entity.type == 'bot_command')
        if (!is_cmd_exist) return
        const record = await comlib.getRecord(msg.chat.id)
        if (!record) return
        const is_enabled = !(record.extag && record.extag['feature:noblue_disabled'])
        if (is_enabled)
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
        [/^\/[0-9a-zA-Z_]{1,}/, removeCmd],
    ]
}
