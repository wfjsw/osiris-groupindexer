var _e, comlib, tmeassist, _ga

async function updateCount(msg, type, bot) {
    if (msg.chat.id > 0) return
    /*if (msg.left_chat_member) {
        if (msg.left_chat_member.id == _e.me.id) {
            return await comlib.silentUpdate(msg.chat.id, {
                member_count: require('rethinkdb').literal()
            })
        }
    }*/
    const record = await comlib.getRecord(msg.chat.id)
    if (!record) return
    let member_count = 0
    try {
        member_count = await bot.getChatMembersCount(msg.chat.id)
    } catch (e) {
        member_count = await tmeassist.getMemberCount(record.is_public ? `https://t.me/${record.username}` : record.invite_link) 
        if (!member_count) member_count = require('rethinkdb').literal()
    }
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
        // if (!record.type == 'channel' && !record.is_public) return
        let member_count = 0
        try {
            member_count = await bot.getChatMembersCount(gid)
        } catch (e) {
            member_count = await tmeassist.getMemberCount(record.is_public ? `https://t.me/${record.username}` : record.invite_link)
            if (!member_count) member_count = require('rethinkdb').literal()
        }
        return await comlib.silentUpdate(gid, {
            member_count
        })
    } catch (e) {
        console.error(e.message)
    }
}

module.exports = {
    init: (e) => {
        _e = e
        comlib = _e.libs['gpindex_common']
        tmeassist = _e.libs['t_me_assistant']
        _ga = e.libs['ga']
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
