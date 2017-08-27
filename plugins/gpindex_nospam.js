const admin_id = require('../config.gpindex.json')['gpindex_admin'];
const temp_admin = []
const halal_capture = -1001135234856

const moment = require('moment')
const util = require('util')
const he = require('he').encode
var _e, comlib, _ga

async function processSpamCheck(msg, bot) {
    if (msg.chat.id > 0) return
    try {
        const user = msg.new_chat_member ? msg.new_chat_member : msg.from
        const uid = user.id
        const nospam_enabled = !(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:nospam_disabled'))
        const spam_time = await comlib.UserFlag.queryUserFlag(uid, 'spam') || 0
        if (nospam_enabled && spam_time != 0 && moment().isSameOrBefore(moment.unix(spam_time))) {
            console.log(`Chat: ${msg.chat.id} User: ${uid} Join Event (Globally Banned)`)
            var bannedtime = moment.unix(spam_time).toNow(true)
            let usermsg = `被封禁用户：<a href="tg://user?id=${user.id}">${user.first_name || ''}`
            if (user.last_name) usermsg += ` ${user.last_name || ''}`
            usermsg += `</a> (${user.id})`
            try {
                await bot.kickChatMember(msg.chat.id, uid, spam_time)
                try {
                    await bot.deleteMessage(msg.chat.id, msg.message_id)
                } catch (e) {}
                await bot.sendMessage(msg.chat.id, `#SPAM #ENFORCED 已检测到并尝试移除已知群发广告用户，有异议请提交工单复核。\nTGCN-工单系统：@tgcntkbot\n\n${usermsg}\n\n封禁解除时间：${bannedtime}`, {
                    parse_mode: 'HTML'
                })
                _ga.tEvent(user, 'noSpam', 'noSpam.kicked')
            } catch (e) {
                await bot.sendMessage(msg.chat.id, `#SPAM 已检测到已知群发广告用户，有异议请提交工单复核。如需自动移除，请将机器人设置为管理员。\nTGCN-工单系统：@tgcntkbot\n\n${usermsg}\n\n封禁解除时间：${bannedtime}`, {
                    parse_mode: 'HTML'
                })
                _ga.tEvent(user, 'noSpam', 'noSpam.not-kicked')
            }
        } else if (spam_time != 0) {
            await comlib.UserFlag.setUserFlag(uid, 'spam', 0);
            _ga.tEvent(user, 'noSpam', 'noSpam.expired')
        } else {
            return await captureHalal(msg, bot)
        }
    } catch (e) {
        console.error(e)
        _ga.tException(msg.from, e, true)
    }
}

function countHalal(string) {
    let len = string.length,
        count = 0
    for (let i = 0; i < len; ++i) {
        let char = string.charCodeAt(i)
        switch (true) {
            case char >= 0x600 && char <= 0x6ff:
            case char >= 0x750 && char <= 0x77f:
            case char >= 0x8a0 && char <= 0x8ff:
            case char >= 0x900 && char <= 0x97f:
            case char >= 0x600 && char <= 0x6ff:
            case char >= 0xa8e0 && char <= 0xa8ff:
            case char >= 0xfb50 && char <= 0xfdff:
            case char >= 0xfe70 && char <= 0xfeff:
                ++count
        }
    }
    return count
}

async function captureHalal(msg, bot) {
    try {
        let need_test = ''
        if (msg.text) need_test += msg.text
        if (msg.caption) need_test += msg.caption
        if (msg.forward_from_chat) need_test += msg.forward_from_chat.title
        let score = countHalal(need_test)
        if (score > 10) {
            let result = await bot.forwardMessage(halal_capture, msg.chat.id, msg.message_id)
            return await bot.sendMessage(halal_capture, `${util.inspect(msg.chat)}\n${util.inspect(msg.from)}`, {
                reply_to_message_id: result.message_id
            })
        }
    } catch (e) {
        console.error(e.stack)
    }
}

async function manuallyEnforceNospam(msg, result, bot) {
    if (msg.chat.id > 0) return
    const user = msg.reply_to_message.from
    if (!user) return
    const uid = user.id
    //const nospam_enabled = !(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:nospam_disabled'))
    const spam_time = await comlib.UserFlag.queryUserFlag(uid, 'spam') || 0
    if (spam_time != 0 && moment().isSameOrBefore(moment.unix(spam_time))) {
        var bannedtime = moment.unix(spam_time).toNow(true)
        const usermsg = `被封禁用户：${user.first_name || ''} ${user.last_name || ''} @${user.username} (${user.id})`
        try {
            await bot.kickChatMember(msg.chat.id, uid, spam_time)
            try {
                await bot.deleteMessage(msg.chat.id, msg.reply_to_message.message_id)
            } catch (e) {}
            const msgl = await bot.sendMessage(msg.chat.id, `#SPAM #ENFORCED 200 OK\n\n${usermsg}\n\n封禁解除时间：${bannedtime}`, {
                reply_to_message_id: msg.message_id
            })
            setTimeout(() => {
                bot.deleteMessage(msg.chat.id, msgl.message_id)
                    .catch(() => {})
            }, 5 * 1000)
            _ga.tEvent(user, 'noSpam', 'noSpam.kicked')
        } catch (e) {
            const msgl = await bot.sendMessage(msg.chat.id, `#SPAM 401 Unauthorized\n\n${usermsg}\n\n封禁解除时间：${bannedtime}`, {
                reply_to_message_id: msg.message_id
            })
            setTimeout(() => {
                bot.deleteMessage(msg.chat.id, msgl.message_id)
                    .catch(() => {})
            }, 5 * 1000)
            _ga.tEvent(user, 'noSpam', 'noSpam.not-kicked')
        }
    } else {
        const msgl = await bot.sendMessage(msg.chat.id, `404 Not Found`, {
            reply_to_message_id: msg.message_id
        })
        setTimeout(() => {
            bot.deleteMessage(msg.chat.id, msgl.message_id)
                .catch(() => {})
        }, 5 * 1000)
    }
}

async function deleteOnly(msg, result, bot) {
    if (msg.chat.id > 0) return
    const user = msg.reply_to_message.from
    if (!user) return
    const uid = user.id
    //const nospam_enabled = !(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:nospam_disabled'))
    const spam_time = await comlib.UserFlag.queryUserFlag(uid, 'spam') || 0
    if (spam_time != 0 && moment().isSameOrBefore(moment.unix(spam_time))) {
        try {
            await bot.deleteMessage(msg.chat.id, msg.reply_to_message.message_id)
            await bot.deleteMessage(msg.chat.id, msg.message_id)
        } catch (e) {
            console.error(e)
        }
    }
}

async function forceEnlist(msg, result, bot) {
    try {
        if (msg.chat.id > 0) return
        const user = msg.reply_to_message.from
        if (!user) return
        const is_admin = !(['left', 'kicked'].indexOf((await bot.getChatMember(admin_id, msg.from.id)).status) > -1)
        if (!is_admin && temp_admin.indexOf(msg.from.id) == -1) return
        const date = moment().add(moment.duration(result[1].toUpperCase())).unix()
        const db_ret = await comlib.UserFlag.setUserFlag(user.id, 'spam', date)
        _e.bot.sendMessage(admin_id, `${user.id} status: spam=${result[1].toUpperCase()}\n\n${require('util').inspect(db_ret)}`)
        await _e.bot.sendMessage(msg.chat.id, `200 OK`, {
            reply_to_message_id: msg.message_id
        })
        return manuallyEnforceNospam(msg, result, bot)
    } catch (e) {
        console.error(e)
    }
}

async function registerTempAdminById(msg, id, bot) {
    if (msg.chat.id == admin_id) {
        temp_admin.push(parseInt(id))
        await _e.bot.sendMessage(msg.chat.id, `200 OK`, {
            reply_to_message_id: msg.message_id
        })
    }
}

async function registerTempAdminMe(msg, result, bot) {
    return registerTempAdminById(msg, msg.from.id, bot)
}

async function registerTempAdminWithId(msg, result, bot) {
    return registerTempAdminById(msg, result[1], bot)
}

async function selfcheckSpamStatus(msg, result, bot) {
    const user = msg.from
    const uid = user.id
    const spam_time = await comlib.UserFlag.queryUserFlag(uid, 'spam') || 0
    if (spam_time != 0 && moment().isSameOrBefore(moment.unix(spam_time))) {
        var bannedtime = moment.unix(spam_time).toNow(true)
        return await bot.sendMessage(msg.chat.id, `您的封禁解除时间：${bannedtime}`, {
            reply_to_message_id: msg.message_id
        })
    } else {
        return await bot.sendMessage(msg.chat.id, `您暂无封禁记录。`, {
            reply_to_message_id: msg.message_id
        })
    }
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    preprocess: processSpamCheck,
    run: [
        [/^\/nospam manual$/, manuallyEnforceNospam],
        [/^\/nospam delonly$/, deleteOnly],
        [/^\/nospam force ([^\s]{1,})$/, forceEnlist],
        [/^\/nospam regtempadmin$/, registerTempAdminMe],
        [/^\/nospam regtempadmin ([0-9]{3,})$/, registerTempAdminWithId],
        [/^\/nospam selfcheck$/, selfcheckSpamStatus]
    ]
}
