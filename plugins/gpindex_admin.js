const admin_id = require('../config.gpindex.json')['gpindex_admin']
const channel_id = require('../config.gpindex.json')['gpindex_channel']
const util = require('util')
const moment = require('moment')

var _e, comlib

function extractId(query, reply) {
    if (!reply) return query
    if (query != 'reply') return query
    if (reply.text) {
        const regexp1 = /([0-9]{5,}) status/
        if (regexp1.test(reply.text)) {
            return regexp1.exec(reply.text)[1]
        }
        const regexp2 = /id: ([0-9-]{5,})/
        if (regexp2.test(reply.text)) {
            return regexp2.exec(reply.text)[1]
        }
        throw new Error('Cannot match ID')
    } else {
        throw new Error('Reply Message not Found')
    }
}

async function removeItem(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const ret = await comlib.doRemoval(extractId(result[1], msg.reply_to_message))
            return await bot.sendMessage(msg.chat.id, util.inspect(ret))
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.message)
        }
    }
}

async function sendMsg(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const ret = await _e.bot.sendMessage(parseInt(extractId(result[1], msg.reply_to_message)), result[2])
            return await bot.sendMessage(msg.chat.id, util.inspect(ret))
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.message);
        }
    }
}

async function markInvaild(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const ret = await comlib.getRecord(extractId(result[1], msg.reply_to_message))
            if (ret) {
                await bot.sendMessage(msg.chat.id, 'Done.')
                return await bot.sendMessage(ret.creator, '您的群组 ' + ret.title + ' 链接已过期，请及时更新。', {
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: '从索引中删除',
                                callback_data: 'admin:remove4mark&' + ret.id
                            }]
                        ]
                    }
                })
            } else {
                return bot.sendMessage(msg.chat.id, 'Not Found')
            }
        } catch (e) {
            return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.message)
        }
    }
}

async function doPublish(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const ret = await comlib.getRecord(extractId(result[1], msg.reply_to_message))
            if (ret) {
                ret.force = 'send'
                if (ret.is_public) comlib.event.emit('new_public_commit', ret)
                else comlib.event.emit('new_private_commit', ret)
                return bot.sendMessage(msg.chat.id, 'Done.')
            } else {
                return bot.sendMessage(msg.chat.id, 'Not Found')
            }
        } catch (e) {
            return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.message)
        }
    }
}

async function doRefreshPublished(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const ret = await comlib.getRecord(extractId(result[1], msg.reply_to_message))
            if (ret) {
                ret.force = 'edit'
                if (ret.is_public) comlib.event.emit('new_public_commit', ret)
                else comlib.event.emit('new_private_commit', ret)
                return bot.sendMessage(msg.chat.id, 'Done.')
            } else {
                return bot.sendMessage(msg.chat.id, 'Not Found')
            }
        } catch (e) {
            return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.message)
        }
    }
}

async function doImportPublicGroup(msg, result, bot) {
    let [gname, tag, desc] = result.slice(1)
    let ginfo = {}
    if (msg.chat.id == admin_id) {
        if (gname && tag && desc) {
            try {
                const chat = await _e.bot.getChat(gname)
                const record = await comlib.getRecord(chat.id)
                let admins
                if (record) {
                    return bot.sendMessage(msg.chat.id, 'Already Exist.')
                } else {
                    admins = await _e.bot.getChatAdministrators(chat.id)
                }
                const ready = admins.some(child => {
                    if (child.status == 'creator') {
                        ginfo = Object.assign(ginfo, chat)
                        ginfo.creator = child.user.id
                        ginfo.is_public = true
                        ginfo.tag = tag
                        ginfo.desc = desc
                        delete ginfo['pinned_message']
                        delete ginfo['all_members_are_administrators']
                        delete ginfo['invite_link']
                        return true
                    } else {
                        return false
                    }
                })
                if (ready) {
                    const db_ret = await comlib.silentInsert(ginfo);
                    bot.sendMessage(msg.chat.id, `${util.inspect(db_ret)}\n\n${util.inspect(ginfo)}`)
                } else {
                    bot.sendMessage(msg.chat.id, 'Cannot get creator status')
                }
            } catch (e) {
                return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.message);
            }
        } else return bot.sendMessage(msg.chat.id, 'Failed to parse Input' + util.inspect(result))
    }
}

async function doImportAnonPublicGroup(msg, result, bot) {
    let [gname, tag, desc] = result.slice(1)
    let ginfo = {}
    if (msg.chat.id == admin_id) {
        if (gname && tag && desc) {
            try {
                const chat = await _e.bot.getChat(gname)
                const record = await comlib.getRecord(chat.id)
                let admins
                if (record) {
                    return bot.sendMessage(msg.chat.id, 'Already Exist.')
                }
                ginfo = Object.assign(ginfo, chat)
                ginfo.creator = 0
                ginfo.is_public = true
                ginfo.tag = tag
                ginfo.desc = desc
                delete ginfo['pinned_message']
                delete ginfo['all_members_are_administrators']
                delete ginfo['invite_link']
                const db_ret = await comlib.silentInsert(ginfo);
                bot.sendMessage(msg.chat.id, `${util.inspect(db_ret)}\n\n${util.inspect(ginfo)}`)
            } catch (e) {
                return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.message);
            }
        } else return bot.sendMessage(msg.chat.id, 'Failed to parse Input' + util.inspect(result))
    }
}

async function doTagMove(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            var [gid, newtag] = result.slice(1)
            gid = extractId(gid, msg.reply_to_message)
            const record = await comlib.getRecord(gid)
            if (record) {
                const db_ret = await comlib.silentUpdate(gid, {
                    tag: newtag
                })
                _e.libs['gpindex_common'].event.emit('passive_updated', {
                    id: gid
                })
                return bot.sendMessage(msg.chat.id, 'Done. \n\n' + util.inspect(db_ret))
            } else {
                return bot.sendMessage(msg.chat.id, 'Not Found')
            }
        } catch (e) {
            return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.message)
        }
    }
}

async function doRemoveFeedByID(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const fid = result[1]
            const ret = await bot.editMessageText('*** 群组信息不可用 ***', {
                chat_id: channel_id,
                message_id: fid
            })
            return bot.sendMessage(msg.chat.id, 'Done. \n\n' + util.inspect(ret))
        } catch (e) {
            return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.message)
        }
    }
}

async function getChat(msg, result, bot) {
    if (msg.chat.id == admin_id)
        try {
            const ret = await bot.getChat(parseInt(extractId(result[1], msg.reply_to_message)))
            return await bot.sendMessage(msg.chat.id, util.inspect(ret));
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.message);
        }
}

async function getChatAdmin(msg, result, bot) {
    if (msg.chat.id == admin_id)
        try {
            const ret = await bot.getChatAdministrators(parseInt(extractId(result[1], msg.reply_to_message)))
            let message = `Group ${parseInt(extractId(result[1], msg.reply_to_message))}\n\n`
            ret.forEach(admin => {
                if (admin.status == 'creator')
                    message += 'C'
                else if (admin.status == 'administrator')
                    message += 'A'
                else
                    message += 'U'

                message += ` ${admin.user.id} ${admin.user.first_name} ${admin.user.last_name || ''} `
                if (admin.status == 'administrator') {
                    message += admin.can_change_info ? 'C' : '-'
                    message += admin.can_delete_messages ? 'D' : '-'
                    message += admin.can_invite_users ? 'I' : '-'
                    message += admin.can_restrict_members ? 'R' : '-'
                    message += admin.can_pin_messages ? 'p' : '-'
                    message += admin.can_promote_members ? 'P' : '-'
                }
                message += '\n'
            })
            message += '\n-----\n'
            message += 'C: can_change_info\n'
            message += 'D: can_delete_messages\n'
            message += 'I: can_invite_users\n'
            message += 'R: can_restrict_members\n'
            message += 'p: can_pin_messages\n'
            message += 'P: can_promote_members\n'
            return await bot.sendMessage(msg.chat.id, message);
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.message);
        }
}

async function getRecord(msg, result, bot) {
    if (msg.chat.id == admin_id)
        try {
            const ret = await comlib.getRecord(parseInt(extractId(result[1], msg.reply_to_message)))
            return await bot.sendMessage(msg.chat.id, util.inspect(ret));
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.message);
        }
}

async function doForceUpdate(msg, result, bot) {
    if (msg.chat.id == admin_id)
        try {
            const chat = await _e.bot.getChat(parseInt(extractId(result[1], msg.reply_to_message)))
            let updation = {
                title: chat.title
            }
            if (chat.username) {
                updation.username = chat.username
                updation.is_public = true
            } else {
                updation.is_public = false
            }
            if (chat.photo) {
                updation.photo = chat.photo
            }
            const db_ret = await comlib.silentUpdate(chat.id, updation)
            _e.libs['gpindex_common'].event.emit('passive_updated', {
                id: chat.id
            })
            return bot.sendMessage(msg.chat.id, util.inspect(db_ret))
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.message)
        }

}

async function getUserFlag(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const flag_ret = await comlib.UserFlag.queryUserFlag(extractId(result[1], msg.reply_to_message), result[2])
            return bot.sendMessage(msg.chat.id, util.inspect(flag_ret))
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.message)
        }
    }
}

async function setUserFlag(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            var value = result[3]
            // There are some extra things to be done for flag 'spam'
            if (result[2] == 'spam') {
                value = moment().add(moment.duration(result[3].toUpperCase())).unix()
            }
            const db_ret = await comlib.UserFlag.setUserFlag(extractId(result[1], msg.reply_to_message), result[2], parseInt(value))
            return bot.sendMessage(msg.chat.id, util.inspect(db_ret))
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.message)
        }
    }
}

async function getGroupExTag(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const flag_ret = await comlib.GroupExTag.queryGroupExTag(extractId(result[1], msg.reply_to_message), result[2])
            return bot.sendMessage(msg.chat.id, util.inspect(flag_ret));
        } catch (e) {
            bot.sendMessage(msg.chat.id, e.message);
        }
    }

}

async function setGroupExTag(msg, result, bot) {
    if (msg.chat.id == admin_id)
        try {
            const db_ret = await comlib.GroupExTag.setGroupExTag(extractId(result[1], msg.reply_to_message), result[2], parseInt(result[3]))
            return bot.sendMessage(msg.chat.id, util.inspect(db_ret));
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.message);
        }
}

async function getUserMention(msg, result, bot) {
    if (msg.chat.id != admin_id) return
    const uid = parseInt(result[1])
    const md = `[${uid}](tg://user?id=${uid})`
    try {
        return await bot.sendMessage(msg.chat.id, md, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return await bot.sendMessage(msg.chat.id, e.message)
    }
}

async function leaveGroup(msg, result, bot) {
    if (msg.chat.id != admin_id) return
    const gid = parseInt(extractId(result[1], msg.reply_to_message))
    try {
        let ret = await bot.leaveChat(gid)
        return await bot.sendMessage(msg.chat.id, ret, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return await bot.sendMessage(msg.chat.id, e.message, {
            parse_mode: 'Markdown'
        })
    }
}

async function banUser(msg, result, bot) {
    if (msg.chat.id != admin_id) return
    const gid = parseInt(extractId(result[1], msg.reply_to_message))
    const uid = parseInt(result[2])
    try {
        let ret = await bot.kickChatMember(gid, uid)
        return await bot.sendMessage(msg.chat.id, ret, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message, {
            parse_mode: 'Markdown'
        })
    }
}

async function unbanUser(msg, result, bot) {
    if (msg.chat.id != admin_id) return
    const gid = parseInt(extractId(result[1], msg.reply_to_message))
    const uid = parseInt(result[2])
    try {
        let ret = await bot.unbanChatMember(gid, uid)
        return await bot.sendMessage(msg.chat.id, ret, {
            parse_mode: 'Markdown'
        })
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message, {
            parse_mode: 'Markdown'
        })
    }
}

async function getMember(msg, result, bot) {
    if (msg.chat.id != admin_id) return
    const gid = parseInt(extractId(result[1], msg.reply_to_message))
    const uid = parseInt(result[2])
    try {
        let ret = await bot.getChatMember(gid, uid)
        return await bot.sendMessage(msg.chat.id, util.inspect(ret))
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message)
    }
}

async function deleteForInvalidMark(gid, msg, bot) {
    try {
        const ret = await comlib.doRemoval(extractId(gid, msg.reply_to_message))
        await bot.editMessageText(msg.message.text + '\n\n成功从索引中删除。', {
            chat_id: msg.message.chat.id,
            message_id: msg.message.message_id
        })
        await bot.answerCallbackQuery({
            callback_query_id: msg.id,
            text: '操作成功。'
        })
        return await bot.sendMessage(admin_id, `Remove from invalid mark: ${gid}\n\n${util.inspect(ret)}`)
    } catch (e) {
        return bot.sendMessage(msg.chat.id, e.message)
    }
}

async function doMigrate(msg, result, bot) {
    try {
        if (msg.chat.id != admin_id) return
        let old_g = parseInt(result[1])
        let new_g = parseInt(result[2])
        const old_data = await comlib.getRecord(old_g)
        if (!old_data) return
        let new_data = Object.assign({}, old_data, {
            id: new_g,
            migrate_from_chat_id: old_g
        })
        delete new_data.extag
        const rm_stat = await comlib.doRemoval(msg.old_g)
        const ins_stat = await comlib.silentInsert(new_data)
        const old_extag = old_data.extag
        await comlib.GroupExTag.setGroupExTag(msg.chat.id, Object.keys(old_extag), Object.values(old_extag))
        comlib.event.emit('passive_updated', new_data)
        await bot.sendMessage(admin_id, util.inspect(new_data))
    } catch (e) {
        console.error(e.message)
        await bot.sendMessage(admin_id, '[admin:460]\n' + util.inspect(e.stack))
    }
}

async function processCallbackButton(msg, type, bot) {
    let datapart = msg.data.split('&')
    switch (datapart[0]) {
        case 'admin:remove4mark':
            return deleteForInvalidMark(parseInt(datapart[1]), msg, bot)
    }
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
    },
    run: [
        [/^\/publish ([0-9-]{6,}|reply)$/, doPublish],
        [/^\/pubrefresh ([0-9-]{6,}|reply)$/, doRefreshPublished],
        [/^\/removeitem ([0-9-]{6,}|reply)$/, removeItem],
        [/^\/markinvalid ([0-9-]{6,}|reply)$/, markInvaild],
        [/^\/import_pub (@[_A-Za-z0-9]{4,}) ([^\n\s]+) ((?:.|\n)+)/m, doImportPublicGroup],
        [/^\/import_anonpub (@[_A-Za-z0-9]{4,}) ([^\n\s]+) ((?:.|\n)+)/m, doImportAnonPublicGroup],
        [/^\/tagmove ([0-9-]{6,}|reply) ([^\n\s]+)$/, doTagMove],
        [/^\/rmfeedid ([0-9]{1,})$/, doRemoveFeedByID],
        [/^\/rmfeedid https:\/\/(?:telegram.me|t.me)\/[_A-Za-z0-9]{4,}\/([0-9]{1,})$/, doRemoveFeedByID],
        [/^\/getchat ([0-9-]{6,}|@[a-zA-Z0-9_]{5,}|reply)$/, getChat],
        [/^\/getadmin ([0-9-]{6,}|@[a-zA-Z0-9_]{5,}|reply)$/, getChatAdmin],
        [/^\/getrecord ([0-9-]{6,}|@[a-zA-Z0-9_]{5,}|reply)$/, getRecord],
        [/^\/forceupdate ([0-9-]{6,}|@[a-zA-Z0-9_]{5,}|reply)$/, doForceUpdate],
        [/^\/getflag ([0-9-]{6,}|reply) ([^\s]+)$/, getUserFlag],
        [/^\/setflag ([0-9-]{6,}|reply) ([^\s]+) ([^\s]+)$/, setUserFlag],
        [/^\/getextag ([0-9-]{6,}|reply) ([^\s]+)$/, getGroupExTag],
        [/^\/setextag ([0-9-]{6,}|reply) ([^\s]+) ([^\s]+)$/, setGroupExTag],
        [/^\/sendmsg ([0-9-]{6,}|@[a-zA-Z0-9_]{5,}|reply) ((?:.|\n)+)/m, sendMsg],
        [/^\/getmention ([0-9]{6,})$/, getUserMention],
        ['callback_query', processCallbackButton],
        [/^\/leave ([0-9-]{6,}|reply)$/, leaveGroup],
        [/^\/ban ([0-9-]{6,}|reply) ([0-9]{6,})$/, banUser],
        [/^\/unban ([0-9-]{6,}|reply) ([0-9]{6,})$/, unbanUser],
        [/^\/getmember ([0-9-]{6,}|reply) ([0-9]{6,})$/, getMember],
        [/^\/migrate ([0-9-]{6,}) ([0-9-]{6,})/, doMigrate]
    ]
}
