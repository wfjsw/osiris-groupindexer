const admin_id = require('../config.gpindex.json')['gpindex_admin'];
const temp_admin = []

const moment = require('moment');
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
            const usermsg = `被封禁用户：${user.first_name || ''} ${user.last_name || ''} @${user.username} (${user.id})`
            try {
                await bot.kickChatMember(msg.chat.id, uid, spam_time)
                try {
                    await bot.deleteMessage(msg.chat.id, msg.message_id)
                } catch (e) {}
                await bot.sendMessage(msg.chat.id, `#SPAM #ENFORCED 已检测到并尝试移除已知群发广告用户，有异议请提交工单复核。\n\n${usermsg}\n\n封禁解除时间：${bannedtime}`)
                _ga.tEvent(user, 'noSpam', 'noSpam.kicked')
            } catch (e) {
                await bot.sendMessage(msg.chat.id, `#SPAM 已检测到已知群发广告用户，有异议请提交工单复核。如需自动移除，请将机器人设置为管理员。\n\n${usermsg}\n\n封禁解除时间：${bannedtime}`)
                _ga.tEvent(user, 'noSpam', 'noSpam.not-kicked')
            }
        } else if (spam_time != 0) {
            await comlib.UserFlag.setUserFlag(uid, 'spam', 0);
            _ga.tEvent(user, 'noSpam', 'noSpam.expired')
        }
    } catch (e) {
        console.error(e)
        _ga.tException(msg.from, e, true)
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
            } catch (e) { }
            const msgl = await bot.sendMessage(msg.chat.id, `#SPAM #ENFORCED 200 OK\n\n${usermsg}\n\n封禁解除时间：${bannedtime}`, {
                reply_to_message_id: msg.message_id
            })
            setTimeout(() => {
                bot.deleteMessage(msg.chat.id, msgl.message_id)
                    .catch(() => { })
            }, 5 * 1000)
            _ga.tEvent(user, 'noSpam', 'noSpam.kicked')
        } catch (e) {
            const msgl = await bot.sendMessage(msg.chat.id, `#SPAM 401 Unauthorized\n\n${usermsg}\n\n封禁解除时间：${bannedtime}`, {
                reply_to_message_id: msg.message_id
            })
            setTimeout(() => {
                bot.deleteMessage(msg.chat.id, msgl.message_id)
                    .catch(() => { })
            }, 5 * 1000)
            _ga.tEvent(user, 'noSpam', 'noSpam.not-kicked')
        }
    } else {
        const msgl = await bot.sendMessage(msg.chat.id, `404 Not Found`, {
            reply_to_message_id: msg.message_id
        })
        setTimeout(() => {
            bot.deleteMessage(msg.chat.id, msgl.message_id)
                .catch(() => { })
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

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    preprocess: processSpamCheck,
    run: [
        [/^\/nospam manual/, manuallyEnforceNospam],
        [/^\/nospam delonly/, deleteOnly],
        [/^\/nospam force ([^\s]{1,})$/, forceEnlist],
        [/^\/nospam regtempadmin$/, registerTempAdminMe],
        [/^\/nospam regtempadmin ([0-9]{3,})$/, registerTempAdminWithId]
    ]
}
