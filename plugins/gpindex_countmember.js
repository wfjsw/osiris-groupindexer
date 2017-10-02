var _e, comlib, _ga

async function updateCount(msg, type, bot) {
    if (msg.chat.id > 0) return
    if (msg.left_chat_member) {
        if (msg.left_chat_member.id == _e.me.id) {
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

async function refreshOnGetDetail(msg, result, bot) {
    try {
        let gid = parseInt(result[1])
        if (gid > 0) return
        const record = await comlib.getRecord(gid)
        if (!record) return
        if (!record.type == 'channel' && !record.is_public) return
        const member_count = await bot.getChatMembersCount(gid)
        return await comlib.silentUpdate(gid, {
            member_count
        })
    } catch (e) {
        // console.error(e.message)
    }
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    run: [
        ['new_chat_members', updateCount],
        ['left_chat_member', updateCount],
        ['channel_post', updateCount],
        ['edited_channel_post', updateCount],
        [/^\/start getdetail=([0-9-]{6,})/, refreshOnGetDetail],
        [/^\/getdetail ([0-9-]{6,})/, refreshOnGetDetail]
    ]
}
