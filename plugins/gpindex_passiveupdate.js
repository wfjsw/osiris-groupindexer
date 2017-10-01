'use strict';
var _e, _ga

const util = require('util')
const ADMIN_GROUP = require('../config.gpindex.json')['gpindex_admin'];

async function passiveUpdate(msg, bot) {
    if (msg.chat.id < 0) {
        var gid = msg.chat.id
        try {
            const record = await _e.libs['gpindex_common'].getRecord(gid)
            var updation = {},
                updatable = false;
            if (record && record.title != msg.chat.title) {
                updation.title = msg.chat.title;
                updatable = true;
            }
            if (record && record.username && msg.chat.username && record.username != msg.chat.username) {
                updation.username = msg.chat.username;
                updatable = true
            }
            if (updatable == true) return _e.libs['gpindex_common'].silentUpdate(gid, updation);
        } catch (e) {
            console.error(e.stack)
            _ga.tException(msg.from.id, e, false)
        }
    }
}

async function passiveUpdateChannel(msg, type, bot) {
    return passiveUpdate(msg, bot)
}

async function doMigrate(msg, type, bot) {
    try {
        const comlib = _e.libs['gpindex_common']
        const old_data = await comlib.getRecord(msg.migrate_from_chat_id)
        if (!old_data) return
        let new_data = Object.assign({}, old_data, {
            id: msg.chat.id
        })
        const rm_stat = await comlib.doRemoval(msg.migrate_from_chat_id)
        const ins_stat = await comlib.silentInsert(new_data)
        await bot.sendMessage(ADMIN_GROUP, `migrated with me: ${msg.migrate_from_chat_id} => ${msg.chat.id}\n\n${util.inspect(rm_stat)}\n${util.inspect(ins_stat)}`)
        await bot.sendMessage(msg.chat.id, '已成功为您转移索引数据到升级后的超级群。请及时使用 `/grouplink_update 新链接` 更新您在索引中注册的邀请链接。转公开群可创建公开链接之后直接使用 `/update` 指令更新。', {
            parse_mode: 'Markdown'
        })
        // _ga.tEvent(msg.chat, 'passiveUpdate', 'passiveUpdate.chatMigrate')
    } catch (e) {
        console.error(e)
        await bot.sendMessage(ADMIN_GROUP, util.inspect(e.stack))
        _ga.tException(msg.chat.id, e, false)
    }
}

async function notifyMigrate(msg, type, bot) {
    try {
        const comlib = _e.libs['gpindex_common']
        const old_data = await comlib.getRecord(msg.migrate_to_chat_id)
        if (!old_data) return
        await bot.sendMessage(ADMIN_GROUP, `migrating: ${msg.migrate_from_chat_id} => ${msg.chat.id}`)
    } catch (e) {
        console.error(e)
        await bot.sendMessage(ADMIN_GROUP, util.inspect(e.stack))
        _ga.tException(msg.chat.id, e, false)
    }
}

async function notifyLeave(msg, type, bot) {
    try {
        if (msg.left_chat_member.id == _e.me.id) {
            return await bot.sendMessage(ADMIN_GROUP, `Leaving ${msg.chat.id}\n${util.inspect(msg.chat)}`)
        }
    } catch (e) {
        console.error(e)
    }
}

module.exports = {
    init: (e) => {
        _e = e;
        _ga = e.libs['ga'];
    },
    preprocess: passiveUpdate,
    run: [
        ['migrate_from_chat_id', doMigrate],
        ['migrate_to_chat_id', notifyMigrate],
        ['left_chat_member', notifyLeave],
        ['channel_post', passiveUpdateChannel]
    ]
}
