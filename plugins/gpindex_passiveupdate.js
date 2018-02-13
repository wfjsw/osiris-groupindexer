'use strict';
var _e, _ga

const util = require('util')
const path = require('path')
const fs = require('fs')
const rp = require('request-promise')
const {
    gpindex_admin,
    groupsicon_location
} = require('../config.gpindex.json')

async function passiveUpdate(chat, record, bot) {
    let gid = chat.id
    var updation = {},
        updatable = false;
    if (record.title != chat.title) {
        updation.title = chat.title
        updatable = true
    }
    if (record.username && chat.username && record.username != chat.username) {
        updation.username = chat.username
        updatable = true
    }
    if (updatable == true) {
        _e.libs['gpindex_common'].event.emit('passive_updated', {
            id: gid
        })
        return _e.libs['gpindex_common'].silentUpdate(gid, updation)
    }
}

async function passiveUpdateOnGroupMsg(msg, bot) {
    if (msg.chat.id < 0) {
        try {
            const record = await _e.libs['gpindex_common'].getRecord(msg.chat.id)
            if (!record) return
            return await passiveUpdate(msg.chat, record, bot)
        } catch (e) {
            console.error(e.message)
            _ga.tException(msg.from.id, e, false)
        }
    }
}

async function passiveUpdateChannel(msg, type, bot) {
    try {
        const record = await _e.libs['gpindex_common'].getRecord(msg.chat.id)
        if (!record) return
        return await passiveUpdate(msg.chat, record, bot)
    } catch (e) {
        console.error(e.message)
    }
}

async function passiveUpdateOnGetDetail(msg, result, bot) {
    setImmediate(async() => {
        try {
            let gid = parseInt(result[1])
            if (!(gid < 0)) return
            const record = await _e.libs['gpindex_common'].getRecord(gid)
            if (!record) return
            let chat = await bot.getChat(gid)
            await passiveUpdate(chat, record, bot)
            //if (chat.photo) {
            //    if (record.photo.small_file_id != chat.photo.small_file_id)
            //        await fetchChatPhoto(chat, bot)
            //} else {
            await fetchChatPhoto(chat, bot)
            //}
        } catch (e) {
            console.error(e.message)
            _ga.tException(msg.from.id, e, false)
        }
    })
}

async function fetchChatPhoto(chat, bot) {
    async function downloadPhoto(id, loc, bot) {
        let url = await bot.getFileLink(id)
        let location = path.join(loc, id + '.jpg')
        return rp(url).pipe(fs.createWriteStream(location))
    }
    const {
        photo
    } = chat
    if (photo) {
        await Promise.all([
            downloadPhoto(photo.small_file_id, groupsicon_location, bot),
            downloadPhoto(photo.big_file_id, groupsicon_location, bot)
        ])
        await _e.libs['gpindex_common'].silentUpdate(chat.id, {
            photo
        })
    } else {
        await _e.libs['gpindex_common'].silentUpdate(chat.id, {
            'photo': {
                small_file_id: '',
                big_file_id: ''
            }
        })
    }
}

async function fetchChatOnEnrollment(upstreaminfo) {
    const bot = _e.bot
    let chat = await bot.getChat(upstreaminfo.id)
    await fetchChatPhoto(chat, bot)
}

async function updateChatPhoto(msg, type, bot) {
    try {
        const record = await _e.libs['gpindex_common'].getRecord(chat.id)
        if (!record) return
        let chat = bot.getChat(msg.chat.id)
        return await fetchChatPhoto(chat, bot)
    } catch (e) {
        console.error(e.message)
        _ga.tException(msg.from.id, e, false)
    }
}

async function doMigrate(msg, type, bot) {
    try {
        const comlib = _e.libs['gpindex_common']
        const old_data = await comlib.getRecord(msg.migrate_from_chat_id)
        if (!old_data) return
        let new_data = Object.assign({}, old_data, {
            id: msg.chat.id,
            migrate_from_chat_id: msg.migrate_from_chat_id
        })
        delete new_data.extag
        const rm_stat = await comlib.doRemoval(msg.migrate_from_chat_id)
        const ins_stat = await comlib.silentInsert(new_data)
        const old_extag = old_data.extag
        await comlib.GroupExTag.setGroupExTag(msg.chat.id, Object.keys(old_extag), Object.values(old_extag))
        await bot.sendMessage(gpindex_admin, `migrated with me: ${msg.migrate_from_chat_id} => ${msg.chat.id}\n\n${util.inspect(rm_stat)}\n${util.inspect(ins_stat)}`)
        await bot.sendMessage(msg.chat.id, '已成功为您转移索引数据到升级后的超级群。创建公开链接之后请点击 `/update` 更新。', {
            parse_mode: 'Markdown'
        })
        comlib.event.emit('new_private_commit', new_data)
        // _ga.tEvent(msg.chat, 'passiveUpdate', 'passiveUpdate.chatMigrate')
    } catch (e) {
        console.error(e.message)
        await bot.sendMessage(gpindex_admin, util.inspect(e.stack))
        _ga.tException(msg.chat.id, e, false)
    }
}

async function notifyMigrate(msg, type, bot) {
    try {
        const comlib = _e.libs['gpindex_common']
        const old_data = await comlib.getRecord(msg.migrate_to_chat_id)
        if (!old_data) return
        await bot.sendMessage(gpindex_admin, `migrating: ${msg.migrate_from_chat_id} => ${msg.chat.id}`)
    } catch (e) {
        console.error(e.message)
        await bot.sendMessage(gpindex_admin, util.inspect(e.stack))
        _ga.tException(msg.chat.id, e, false)
    }
}

async function notifyLeave(msg, type, bot) {
    try {
        if (msg.left_chat_member.id == _e.me.id) {
            return await bot.sendMessage(gpindex_admin, `Leaving ${msg.chat.id}\n${util.inspect(msg.chat)}`)
        }
    } catch (e) {
        console.error(e.message)
    }
}

async function notifyJoin(msg, type, bot) {
    try {
        if (msg.new_chat_members[0].id == _e.me.id) {
            return await bot.sendMessage(gpindex_admin, `Joining ${msg.chat.id}\n${util.inspect(msg.chat)}`)
        }
    } catch (e) {
        console.error(e.message)
    }
}

module.exports = {
    init: (e) => {
        _e = e
        _ga = e.libs['ga']
        let eventbus = e.libs['gpindex_common'].event
        eventbus.on('fetch_chat_photo', fetchChatPhoto)
        eventbus.on('new_public_commit', fetchChatOnEnrollment)
        eventbus.on('update_public_data', fetchChatOnEnrollment)
        eventbus.on('new_private_commit', fetchChatOnEnrollment)
        eventbus.on('update_private_data', fetchChatOnEnrollment)
    },
    preprocess: passiveUpdateOnGroupMsg,
    run: [
        ['migrate_from_chat_id', doMigrate],
        ['migrate_to_chat_id', notifyMigrate],
        ['left_chat_member', notifyLeave],
        ['new_chat_members', notifyJoin],
        ['channel_post', passiveUpdateChannel],
        ['new_chat_photo', updateChatPhoto],
        ['delete_chat_photo', updateChatPhoto],
        [/^\/start getdetail=([0-9-]{6,})/, passiveUpdateOnGetDetail],
        [/^\/getdetail=([0-9-]{6,})/, passiveUpdateOnGetDetail],
    ]
}
