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
            return bot.sendMessage(msg.chat.id, e.stack)
        }
    }
}

async function sendMsg(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const ret = await _e.bot.sendMessage(parseInt(extractId(result[1], msg.reply_to_message)), result[2])
            return await bot.sendMessage(msg.chat.id, util.inspect(ret))
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.stack);
        }
    }
}

async function markInvaild(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const ret = await comlib.getRecord(extractId(result[1], msg.reply_to_message))
            if (ret) {
                await bot.sendMessage(msg.chat.id, 'Done.')
                return await bot.sendMessage(ret.creator, '您的群组 ' + ret.title + ' 链接已过期，请及时更新。')
            } else {
                return bot.sendMessage(msg.chat.id, 'Not Found')
            }
        } catch (e) {
            return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.stack)
        }
    }
}

async function doPublish(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const ret = await comlib.getRecord(extractId(result[1], msg.reply_to_message))
            if (ret) {
                if (ret.is_public) comlib.event.emit('new_public_commit', ret)
                else comlib.event.emit('new_private_commit', ret)
                return bot.sendMessage(msg.chat.id, 'Done.')
            } else {
                return bot.sendMessage(msg.chat.id, 'Not Found')
            }
        } catch (e) {
            return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.stack)
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
                return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.stack);
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
                return bot.sendMessage(msg.chat.id, 'Done. \n\n' + util.inspect(db_ret))
            } else {
                return bot.sendMessage(msg.chat.id, 'Not Found')
            }
        } catch (e) {
            return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.stack)
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
            return bot.sendMessage(msg.chat.id, 'Failed\n\n' + e.stack)
        }
    }
}

async function getChat(msg, result, bot) {
    if (msg.chat.id == admin_id)
        try {
            const ret = await _e.bot.getChat(parseInt(extractId(result[1], msg.reply_to_message)))
            return await bot.sendMessage(msg.chat.id, util.inspect(ret));
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.stack);
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
            const db_ret = await comlib.silentUpdate(chat.id, updation)
            return bot.sendMessage(msg.chat.id, util.inspect(db_ret))
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.stack)
        }

}

async function getUserFlag(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const flag_ret = await comlib.UserFlag.queryUserFlag(extractId(result[1], msg.reply_to_message), result[2])
            return bot.sendMessage(msg.chat.id, util.inspect(flag_ret))
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.stack)
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
            return bot.sendMessage(msg.chat.id, e.stack)
        }
    }
}

async function getGroupExTag(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        try {
            const flag_ret = await comlib.GroupExTag.queryGroupExTag(extractId(result[1], msg.reply_to_message), result[2])
            return bot.sendMessage(msg.chat.id, util.inspect(flag_ret));
        } catch (e) {
            bot.sendMessage(msg.chat.id, e.stack);
        }
    }

}

async function setGroupExTag(msg, result, bot) {
    if (msg.chat.id == admin_id)
        try {
            const db_ret = await comlib.GroupExTag.setGroupExTag(extractId(result[1], msg.reply_to_message), result[2], parseInt(result[3]))
            return bot.sendMessage(msg.chat.id, util.inspect(db_ret));
        } catch (e) {
            return bot.sendMessage(msg.chat.id, e.stack);
        }
}


module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
    },
    run: [
        [/^\/publish ([0-9-]{6,}|reply)$/, doPublish],
        [/^\/removeitem ([0-9-]{6,}|reply)$/, removeItem],
        [/^\/markinvalid ([0-9-]{6,}|reply)$/, markInvaild],
        [/^\/import_pub (@[_A-Za-z0-9]{4,}) ([^\n\s]+) ((?:.|\n)+)/m, doImportPublicGroup],
        [/^\/tagmove ([0-9-]{6,}) ([^\n\s]+)$/, doTagMove],
        [/^\/rmfeedid ([0-9]{1,})$/, doRemoveFeedByID],
        [/^\/rmfeedid https:\/\/(?:telegram.me|t.me)\/[_A-Za-z0-9]{4,}\/([0-9]{1,})$/, doRemoveFeedByID],
        [/^\/getchat ([0-9-]{6,}|@[a-zA-Z0-9_]{5,}|reply)$/, getChat],
        [/^\/forceupdate ([0-9-]{6,}|@[a-zA-Z0-9_]{5,}|reply)$/, doForceUpdate],
        [/^\/getflag ([0-9-]{6,}|reply) ([^\s]+)$/, getUserFlag],
        [/^\/setflag ([0-9-]{6,}|reply) ([^\s]+) ([^\s]+)$/, setUserFlag],
        [/^\/getextag ([0-9-]{6,}|reply) ([^\s]+)$/, getGroupExTag],
        [/^\/setextag ([0-9-]{6,}|reply) ([^\s]+) ([^\s]+)$/, setGroupExTag],
        [/^\/sendmsg ([0-9-]{6,}|@[a-zA-Z0-9_]{5,}|reply) ((?:.|\n)+)/m, sendMsg]
    ]
}
