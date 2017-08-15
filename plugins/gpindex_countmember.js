var _e, comlib, _ga

async function updateCount(msg, type, bot) {
    if (msg.chat.id > 0) return
    if (msg.left_chat_member) {
        if (msg.left_chat_member.id = _e.me.id) {
            return await comlib.silentUpdate(msg.chat.id, {
                member_count: require('rethinkdb').literal()
            })
        }
    }
    const record = await comlib.getRecord(msg.chat.id)
    if (!record) return
    const member_count = await bot.getChatMembersCount(msg.chat.id)
    return await comlib.silentUpdate(msg.chat.id, {
        member_count
    })
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    run: [
        ['new_chat_member', updateCount],
        ['left_chat_member', updateCount]
    ]
}
