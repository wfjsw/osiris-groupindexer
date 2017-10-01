'use strict';

var comlib

async function removeService(msg, type, bot) {
    const record = await comlib.getRecord(msg.chat.id)
    if (!record) return
    const is_enabled = !!(record.extag && record.extag['feature:deljoin'])
    if (is_enabled)
        return bot.deleteMessage(msg.chat.id, msg.message_id)
            .catch((e) => {
                console.error(e.message)
            })
}

module.exports = {
    init: (e) => {
        comlib = e.libs['gpindex_common'];
    },
    run: [
        ['new_chat_members', removeService],
        ['left_chat_member', removeService]
    ]
}
