const langCodeBanned = new Set(['fa-IR', 'fa'])
const halal_display_name = /sharma|pollsciemo|amarhs|moham|ali.*reza|ahmed/i
const halal_keyboard_match = /@TGNumberBot/i
const max_halal_char_threshold = 12
const max_halal_pct_threshold = 0.45
const send_capture_threshold = 120
const send_notification_threshold = 120
const kick_wait_threshold = 30
const cancel_keyboard_threshold = 15

const antihalal_manager = -1001159383809
const chan_capture = -1001135234856
var _e, comlib
let last_sent_group = new Map()
let last_sent_capture = new Map()
let last_sent_cancelkeyboard = new Map()
let last_kicked = new Map()
let sticker_pack_name_cache = new Map()
let tempwhitelist = new Map()
const util = require('util')

function genHalalKB(id) {
    return {
        inline_keyboard: [
            [{
                text: '上交给真主安拉',
                callback_data: 'antihalal:h&' + id
            }],
            [{
                text: '不，这不清真',
                callback_data: 'antihalal:nh&' + id
            }]
        ]
    }
}

function genHalalKB_G(gid, uid) {
    return {
        inline_keyboard: [
            [{
                text: '不，这不清真',
                callback_data: 'antihalal:gnh&' + uid
            }]
        ]
    }
}

async function uploadHalal(msg, bot) {
    let is_nocapture = !!(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'nocapture'))
    if (is_nocapture) return
    let send = false
    if (last_sent_capture.has(msg.from.id.toString())) {
        if (Math.floor(Date.now() / 1000) - last_sent_capture.get(msg.from.id.toString()) > send_capture_threshold) {
            send = true
        }
    } else {
        send = true
    }
    if (send) {
        last_sent_capture.set(msg.from.id.toString(), msg.date)
        let result = await bot.forwardMessage(chan_capture, msg.chat.id, msg.message_id)
        await bot.sendMessage(chan_capture, `${util.inspect(msg.chat)}\n\n${util.inspect(msg.from)}`, {
            reply_to_message_id: result.message_id,
            reply_markup: genHalalKB(msg.from.id)
        })
    }
}

function testHalal(str) {
    let string = str.replace(/[\s\uFEFF\xA0]+/g, '')
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
        if (count >= max_halal_char_threshold)
            return true
    }
    if (count / len >= max_halal_pct_threshold)
        return true
    return false
}

function gcArray() {
    let d = Math.floor(Date.now() / 1000)
    for (let [k, v] of last_sent_group)
        if (d - v > send_notification_threshold)
            last_sent_group.delete(k)
    for (let [k, v] of last_sent_capture)
        if (d - v > send_capture_threshold)
            last_sent_capture.delete(k)
    for (let [k, v] of last_sent_cancelkeyboard)
        if (d - v > cancel_keyboard_threshold)
            last_sent_cancelkeyboard.delete(k)
    for (let [k, v] of last_kicked)
        if (d - v > kick_wait_threshold)
            last_kicked.delete(k)
}

const additional_ruleset = {
    'sharma': (msg) => {
        let rgx = /sharma|dev|开发|下马|amrahs|ved/i
        let uname = msg.from.first_name + msg.from.last_name
        if (uname.match(rgx)) return true
        return false
    }
}

async function execAdditionalRuleset(msg) {
    for (let rs in additional_ruleset) {
        let is_used = await comlib.GroupExTag.queryGroupExTag(msg.chat.id, `feature:antihalal.ruleset.${rs}`)
        if (!is_used) continue
        let result = additional_ruleset[rs](msg)
        if (result) return true
    }
}

async function privateLanguageDetection(msg, bot) {
    let {
        description
    } = await bot.getChat(msg.from.id)
    let display_name = msg.from.first_name + (msg.from.last_name || '')
    let is_halal = testHalal(display_name) || testHalal(description || '') || !!(display_name + (msg.from.username || '')).match(halal_display_name) || langCodeBanned.has(msg.from.language_code)
    if (is_halal) {
        let send = false
        if (last_sent_capture.has(msg.from.id.toString())) {
            if (Math.floor(Date.now() / 1000) - last_sent_capture.get(msg.from.id.toString()) > send_capture_threshold) {
                send = true
            }
        } else {
            send = true
        }
        if (send) {
            last_sent_capture.set(msg.from.id.toString(), msg.date)
            let result = await bot.forwardMessage(chan_capture, msg.chat.id, msg.message_id)
            await bot.sendMessage(chan_capture, `Private Chat\n\n${util.inspect(msg.from)}\n\n已经根据语言上交给安拉。`, {
                reply_to_message_id: result.message_id
            })
        }
        // bot.sendMessage(msg.from.id, '抱歉，您无权使用此服务。')
        // await comlib.UserFlag.setUserFlag(msg.from.id, 'block', 1)
        await comlib.UserFlag.setUserFlag(msg.from.id, 'halal', 1)
        return true
    }
    return false
}

async function examineDisplayName(msg, new_member, bot) {
    let inviter_desc = (await bot.getChat(msg.from.id)).description || ''
    let inviter_display_name = msg.from.first_name + (msg.from.last_name || '') + inviter_desc
    let newmember_desc = (await bot.getChat(new_member.id)).description || ''
    let display_name = new_member.first_name + (new_member.last_name || '') + newmember_desc
    const is_kick_halal_name = !!await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:antihalal.name')
    let is_halal = testHalal(inviter_display_name) || testHalal(display_name) || !!(display_name + (new_member.username || '')).match(halal_display_name) || langCodeBanned.has(new_member.language_code) || langCodeBanned.has(msg.from.language_code)
    if (is_halal) {
        let is_nocapture = !!(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'nocapture'))
        if (!is_nocapture) {
            await bot.sendMessage(chan_capture, `清真加群\n\n${util.inspect(msg.chat)}\n搞事的人\n${util.inspect(msg.from)}\n清真\n${util.inspect(new_member)}`, {
                reply_markup: genHalalKB(new_member.id)
            })
        }
        if (is_kick_halal_name || new_member.is_bot) {
            kickByHalal(msg.chat, new_member, false, bot)
        }
    }
}

async function examineSticker(msg, bot) {
    let display_name = msg.from.first_name + (msg.from.last_name || '')
    let stickerset = msg.sticker.set_name
    let stickersetname = sticker_pack_name_cache.get(stickerset) || (await bot.getStickerSet(stickerset)).title
    const [is_sticker, is_name] = await comlib.GroupExTag.queryGroupExTag(msg.chat.id, ['feature:antihalal.sticker', 'feature:antihalal.name'])
    sticker_pack_name_cache.set(stickerset, stickersetname)
    let is_halal = testHalal(stickersetname) || langCodeBanned.has(msg.from.language_code)
    let is_halalname = testHalal(display_name + stickersetname)
    if (is_halal) {
        await uploadHalal(msg, bot)
        if (!tempwhitelist.has(msg.chat.id.toString() + msg.from.id.toString()) && is_sticker)
            await kickByHalal(msg.chat, msg.from, false, bot)
        return true
    }
    if (is_halalname) {
        await uploadHalal(msg, bot)
        if (!tempwhitelist.has(msg.chat.id.toString() + msg.from.id.toString()) && is_sticker && is_name) {
            await kickByHalal(msg.chat, msg.from, false, bot)
            return true
        }
    }
    return false
}

async function examineNormalMsg(msg, bot) {
    const is_name = !!await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:antihalal.name')
    let need_test = ''
    let display_name = msg.from.first_name + (msg.from.last_name || '')
    let is_halal = langCodeBanned.has(msg.from.language_code)
    let is_halal_name = testHalal(display_name)
    if (msg.text) {
        need_test += msg.text
        is_halal = is_halal || testHalal(msg.text)
    }
    if (msg.caption) {
        need_test += msg.caption
        is_halal = is_halal || testHalal(msg.caption)
    }
    if (msg.forward_from_chat) {
        need_test += msg.forward_from_chat.title
        is_halal = is_halal || testHalal(msg.forward_from_chat.title)
    }
    is_halal = is_halal || testHalal(need_test)
    if (is_halal) {
        await uploadHalal(msg, bot)
        if (!tempwhitelist.has(msg.chat.id.toString() + msg.from.id.toString()))
            await kickByHalal(msg.chat, msg.from, false, bot)
        return true
    }
    if (is_halal_name) {
        await uploadHalal(msg, bot)
        if (!tempwhitelist.has(msg.chat.id.toString() + msg.from.id.toString()) && is_name) {
            await kickByHalal(msg.chat, msg.from, false, bot)
            return true
        }
    }
    return false
}

async function kickByHalal(group, user, is_flag, bot) {
    const [is_halal_process_enabled, is_nodb_enabled] = await comlib.GroupExTag.queryGroupExTag(group.id, ['feature:antihalal', 'feature:antihalal.nodb'])
    if (is_nodb_enabled && is_flag) return
    if (is_halal_process_enabled) {
        let usermsg = `清真用户：<a href="tg://user?id=${user.id}">${user.first_name || ''}`
        if (user.last_name) usermsg += ` ${user.last_name || ''}`
        usermsg += `</a> (${user.id})`
        try {
            if (last_kicked.has(group.id.toString() + user.id.toString())) {
                if (Math.floor(Date.now() / 1000) - last_kicked.get(group.id.toString() + user.id.toString()) > kick_wait_threshold) {
                    last_kicked.set(group.id.toString() + user.id.toString(), Math.floor(Date.now() / 1000))
                    await bot.kickChatMember(group.id, user.id)
                }
            } else {
                last_kicked.set(group.id.toString() + user.id.toString(), Math.floor(Date.now() / 1000))
                await bot.kickChatMember(group.id, user.id)
            }
            let send = false
            if (last_sent_group.has(group.id.toString() + user.id.toString())) {
                if (Math.floor(Date.now() / 1000) - last_sent_group.get(group.id.toString() + user.id.toString()) > send_notification_threshold) {
                    send = true
                }
            } else {
                send = true
            }
            if (send) {
                last_sent_group.set(group.id.toString() + user.id.toString(), Math.floor(Date.now() / 1000))
                let message = !is_flag ? `#HALAL #ENFORCED 已检测到一个清真并且吃掉了。如果出现误报请群组管理员点击下面的按钮临时解封并上报。\n\n${usermsg}` : `#HALAL #ENFORCED 已检测到一个清真并且吃掉了。如果出现误处理请联系工单加入清真白名单。\nTGCN-工单系统：@tgcntkbot\n\n${usermsg}`
                await bot.sendMessage(group.id, message, {
                    parse_mode: 'HTML',
                    reply_markup: is_flag ? null : genHalalKB_G(group.id, user.id)
                })
            }
        } catch (e) {
            let send = false
            if (last_sent_group.has(group.id.toString() + user.id.toString())) {
                if (Math.floor(Date.now() / 1000) - last_sent_group.get(group.id.toString() + user.id.toString()) > send_notification_threshold) {
                    send = true
                }
            } else {
                send = true
            }
            if (send) {
                last_sent_group.set(group.id.toString() + user.id.toString(), Math.floor(Date.now() / 1000))
                await bot.sendMessage(group.id, `#HALAL 已检测到一个清真，如果出现误处理请联系工单加入清真白名单。如需自动吃掉，请授予机器人封禁用户的权限。\nTGCN-工单系统：@tgcntkbot\n\n${usermsg}`, {
                    parse_mode: 'HTML'
                })
            }
        }
    }
}

async function removeKeyboard(msg, bot) {
    const [is_halal_process_enabled] = await comlib.GroupExTag.queryGroupExTag(msg.chat.id, ['feature:antihalal'])
    if (!is_halal_process_enabled) return false 
    if (last_sent_cancelkeyboard.has(msg.chat.id.toString())) 
        if (Math.floor(Date.now() / 1000) - last_sent_group.get(msg.chat.id.toString()) <= cancel_keyboard_threshold)
            return false
    last_sent_cancelkeyboard.set(msg.chat.id.toString(), Math.floor(Date.now() / 1000))
    let cclmsg = await bot.sendMessage(msg.chat.id, '检测到清真键盘，已将键盘恢复到正常状况。3 秒钟后该消息会自行删除。', {
        reply_markup: {
            hide_keyboard: true
        }
    })
    setTimeout((m) => {
        bot.deleteMessage(m.chat.id, m.message_id)
            .catch(() => { })
    }, 3 * 1000, cclmsg)
 }

async function preProcessStack(msg, bot) {
    try {
        if (msg.text) {
            if (msg.text.match(halal_keyboard_match)) {
                await removeKeyboard(msg, bot)
            }
        }
        const non_halal = await comlib.UserFlag.queryUserFlag(msg.from.id, 'nothalal')
        if (non_halal) return
        let is_halal
        if (msg.chat.id > 0) {
            return await privateLanguageDetection(msg, bot)
        } else if (msg.new_chat_members) {
            for (let member of msg.new_chat_members) {
                const halal = !!await comlib.UserFlag.queryUserFlag(member.id, 'halal')
                if (halal) {
                    await kickByHalal(msg.chat, member, true, bot)
                    is_halal = true
                } else {
                    await examineDisplayName(msg, member, bot)
                }
            }
        } else if (!msg.left_chat_member) {
            const halal = !!await comlib.UserFlag.queryUserFlag(msg.from.id, 'halal')
            if (halal) {
                await kickByHalal(msg.chat, msg.from, true, bot)
                is_halal = true
            } else if (msg.sticker) {
                is_halal = await examineSticker(msg, bot) || is_halal
            } else {
                is_halal = await examineNormalMsg(msg, bot) || is_halal
            }
        }
        if (!is_halal && msg.chat.id < 0) is_halal = await execAdditionalRuleset(msg)
        if (is_halal) {
            const is_halal_process_enabled = !!await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:antihalal')
            if (is_halal_process_enabled) {
                try {
                    await bot.deleteMessage(msg.chat.id, msg.message_id)
                } catch (e) {}
            }
        }
    } catch (e) {
        console.error(e.stack)
    }
}

async function processCallbackQuery(msg, type, bot) {
    const [operator, query] = msg.data.split(':')
    if (operator == 'antihalal') {
        let [q, uid] = query.split('&')
        uid = parseInt(uid)
        const is_superadmin = !(['left', 'kicked'].indexOf((await bot.getChatMember(antihalal_manager, msg.from.id)).status) > -1)
        switch (q) {
            case 'h':
                if (is_superadmin) {
                    // await comlib.UserFlag.setUserFlag(uid, 'block', 1)
                    await comlib.UserFlag.setUserFlag(uid, 'halal', 1)
                    await bot.editMessageText(`${msg.message.text}\n\n✅安拉胡阿克巴，已经上交给了真主安拉。老阿訇：${msg.from.first_name} ${msg.from.last_name}`, {
                        chat_id: msg.message.chat.id,
                        message_id: msg.message.message_id,
                    })
                    return bot.answerCallbackQuery(msg.id, {
                        text: '已经上交给了真主安拉。'
                    })
                } else {
                    return bot.answerCallbackQuery(msg.id, {
                        text: '你不是老阿訇。'
                    })
                }
            case 'nh':
                if (is_superadmin) {
                    await comlib.UserFlag.setUserFlag(uid, 'nothalal', 1)
                    await bot.editMessageText(`${msg.message.text}\n\n✅好的，这不清真。老阿訇：${msg.from.first_name} ${msg.from.last_name}`, {
                        chat_id: msg.message.chat.id,
                        message_id: msg.message.message_id,
                    })
                    return bot.answerCallbackQuery(msg.id, {
                        text: '好的，这不清真。'
                    })
                } else {
                    return bot.answerCallbackQuery(msg.id, {
                        text: '你不是老阿訇。'
                    })
                }
            case 'gnh':
                const is_groupadmin = ['creator', 'administrator'].indexOf((await bot.getChatMember(msg.message.chat.id, msg.from.id)).status) > -1
                if (is_superadmin || is_groupadmin) {
                    await bot.editMessageText(`${msg.message.text}\n\n✅好的，这不清真。阿訇：${msg.from.first_name} ${msg.from.last_name}`, {
                        chat_id: msg.message.chat.id,
                        message_id: msg.message.message_id,
                    })
                    await bot.sendMessage(chan_capture, `${util.inspect(msg.message.chat)}\n管理员 ${msg.from.first_name} ${msg.from.last_name} \n 表示 ${uid} 不清真`)
                    tempwhitelist.set(msg.message.chat.id.toString() + uid.toString(), true)
                    try {
                        await bot.unbanChatMember(msg.message.chat.id, uid)
                    } catch (e) {}
                    return bot.answerCallbackQuery(msg.id, {
                        text: '好的，这不清真。'
                    })
                } else {
                    return bot.answerCallbackQuery(msg.id, {
                        text: '你不是阿訇。'
                    })
                }
        }
    }
}

async function manuallyHalal(msg, result, bot) {
    if (msg.chat.id > 0) return
    try {
        const is_admin = !(['left', 'kicked'].indexOf((await bot.getChatMember(antihalal_manager, msg.from.id)).status) > -1)
        if (!is_admin) return
        const replyto = msg.reply_to_message
        if (!replyto) {
            return await bot.sendMessage(msg.chat.id, 'Unable to locate sender')
        }
        let target = msg.reply_to_message.from.id
        // await uploadHalal(replyto, bot)
        await comlib.UserFlag.setUserFlag(target, 'halal', 1)
        await bot.sendMessage(antihalal_manager, `Manually Halaled\nUID: ${target}\nGID: ${msg.chat.id}\nGTITLE: ${msg.chat.title}\nOID: ${msg.from.id}`)
        await kickByHalal(msg.chat, msg.reply_to_message.from, true, bot)
    } catch (e) {
        console.error(e.stack)
    }


}

async function debugTestHalal(msg, result, bot) {
    let need_test = ''
    let display_name = msg.reply_to_message.from.first_name + (msg.reply_to_message.from.last_name || '')
    need_test += display_name
    let is_halal = testHalal(display_name) || langCodeBanned.has(msg.reply_to_message.from.language_code)
    if (msg.reply_to_message.text) {
        need_test += msg.reply_to_message.text
        is_halal = is_halal || testHalal(msg.reply_to_message.text)
    }
    if (msg.reply_to_message.caption) {
        need_test += msg.reply_to_message.caption
        is_halal = is_halal || testHalal(msg.reply_to_message.caption)
    }
    if (msg.reply_to_message.forward_from_chat) {
        need_test += msg.reply_to_message.forward_from_chat.title
        is_halal = is_halal || testHalal(msg.reply_to_message.forward_from_chat.title)
    }
    is_halal = is_halal || testHalal(need_test)
    await bot.sendMessage(msg.chat.id, `testHalal: ${is_halal}`)

}

async function banUser(msg, result, bot) {
    if (msg.chat.id != antihalal_manager) return
    const gid = parseInt(result[1])
    const uid = parseInt(result[2])
    try {
        let ret = await bot.kickChatMember(gid, uid)
        return await bot.sendMessage(msg.chat.id, `OID: ${msg.from.id}\n${msg.text}\n\n${util.inspect(ret)}`, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message, {
            parse_mode: 'Markdown'
        })
    }
}

async function unbanUser(msg, result, bot) {
    if (msg.chat.id != antihalal_manager) return
    const gid = parseInt(result[1])
    const uid = parseInt(result[2])
    try {
        let ret = await bot.unbanChatMember(gid, uid)
        return await bot.sendMessage(msg.chat.id, `OID: ${msg.from.id}\n${msg.text}\n\n${util.inspect(ret)}`, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message, {
            parse_mode: 'Markdown'
        })
    }
}

async function setHalal(msg, result, bot) {
    if (msg.chat.id != antihalal_manager) return
    const uid = parseInt(result[1])
    try {
        let ret = await comlib.UserFlag.setUserFlag(uid, ['halal', 'nothalal'], [1, 0])
        return await bot.sendMessage(msg.chat.id, `OID: ${msg.from.id}\n${msg.text}\n\n${util.inspect(ret)}`, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message, {
            parse_mode: 'Markdown'
        })
    }
}

async function setNotHalal(msg, result, bot) {
    if (msg.chat.id != antihalal_manager) return
    const uid = parseInt(result[1])
    try {
        let ret = await comlib.UserFlag.setUserFlag(uid, ['halal', 'nothalal'], [0, 1])
        return await bot.sendMessage(msg.chat.id, `OID: ${msg.from.id}\n${msg.text}\n\n${util.inspect(ret)}`, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message, {
            parse_mode: 'Markdown'
        })
    }
}

async function setRejudge(msg, result, bot) {
    if (msg.chat.id != antihalal_manager) return
    const uid = parseInt(result[1])
    try {
        let ret = await comlib.UserFlag.setUserFlag(uid, ['halal', 'nothalal'], [0, 0])
        return await bot.sendMessage(msg.chat.id, `OID: ${msg.from.id}\n${msg.text}\n\n${util.inspect(ret)}`, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message, {
            parse_mode: 'Markdown'
        })
    }
}

async function getId(msg, result, bot) {
    return bot.sendMessage(msg.chat.id, `GID: ${msg.chat.id || '¯\\_(ツ)_/¯'}\nUID: ${msg.reply_to_message ? `<a href=\"tg://user?id=${msg.reply_to_message.from.id}\">${msg.reply_to_message.from.id}</a>` : '¯\\_(ツ)_/¯'}`, {
        parse_mode: 'HTML'
    })
}

async function getUserMention(msg, result, bot) {
    if (msg.chat.id != antihalal_manager) return
    const uid = parseInt(result[1])
    const md = `[${uid}](tg://user?id=${uid})`
    try {
        return await bot.sendMessage(msg.chat.id, md, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message, {
            parse_mode: 'Markdown'
        })
    }
}

async function halalStat(msg, result, bot) {
    if (msg.chat.id != antihalal_manager) return
    try {
        const [is_halal, is_nothalal] = await comlib.UserFlag.queryUserFlag(parseInt(result[1]), ['halal', 'nothalal'])
        return bot.sendMessage(msg.chat.id, `HALAL: ${!!is_halal}\nNOTHALAL: ${!!is_nothalal}\nOVERALL: ${!!(is_halal && !is_nothalal)}`)
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message)
    }
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        setInterval(gcArray, 5 * 60 * 1000)
    },
    preprocess: preProcessStack,
    run: [
        ['callback_query', processCallbackQuery],
        [/^\/debug testHalalPoint/, debugTestHalal],
        [/^\/halal$/, manuallyHalal],
        [/^\/ban ([0-9-]{6,}|reply) ([0-9]{6,})$/, banUser],
        [/^\/unban ([0-9-]{6,}|reply) ([0-9]{6,})$/, unbanUser],
        [/^\/halal ([0-9]{6,})$/, setHalal],
        [/^\/nothalal ([0-9]{6,})$/, setNotHalal],
        [/^\/rejudge ([0-9]{6,})$/, setRejudge],
        [/^\/id$/, getId],
        [/^\/getmention ([0-9]{6,})$/, getUserMention],
        [/^\/halalstat ([0-9]{6,})/, halalStat]
    ]
}
