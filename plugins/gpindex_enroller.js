const util = require('util');

const admin_id = require('../config.gpindex.json')['gpindex_admin'];

var langres = require('../resources/gpindex_enroller.json');
var session = {};
var _e, comlib, _ga
var tags = require('../config.gpindex.json')['gpindex_tags'];

/**
 * Process runtime error (friendly)
 * @param {object} msg 
 * @param {object} bot 
 * @param {error} err 
 */
function errorProcess(msg, bot, err) {
    if (err == 'notValidated') return
    var errorlog = '```\n' + err.stack + '```\n';
    console.error(err);
    _ga.tException(msg.from, err, true)
    bot.sendMessage(msg.chat.id, langres['infoBugReport'], {
        reply_to_message_id: msg.message_id
    });
    bot.sendMessage(admin_id, errorlog, {
        parse_mode: 'Markdown'
    });
    purgeState(msg, 'errrpt', bot);
}

/**
 * Send "Choose the Group" hint
 * @param {object} msg 
 * @param {array} result 
 * @param {object} bot 
 */
async function startEnrollment(msg, result, bot) {
    // Check state
    if (!session[msg.from.id]) {
        if (msg.chat.id > 0) {
            try {
                const is_validated = await comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
                const is_blocked = await comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
                if (!(_e.plugins['gpindex_validateuser'] && !is_validated)) {
                    if (!is_blocked) {
                        var cburl = `https://telegram.me/${_e.me.username}?startgroup=grpselect`
                        return await bot.sendMessage(msg.from.id, langres['promptChooseGroup'], {
                            reply_to_message_id: msg.message_id,
                            disable_web_page_preview: true,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: langres['buttonChooseGroup'],
                                        url: cburl
                                    }],
                                    [{
                                        text: langres['buttonEnrollChannelReadme'],
                                        callback_data: 'enroller_manual_channel'
                                    }]
                                ]
                            }
                        })
                    } else {
                        return await bot.sendMessage(msg.chat.id, langres['errorUserBanned']);
                    }
                }
            } catch (e) {
                return errorProcess(msg, bot, e)
            }
        } else {
            return groupChosen(msg, result, bot)
        }
    } else {
        return bot.sendMessage(msg.from.id, langres['infoBusyState'], {
            reply_to_message_id: msg.message_id
        })
    }

}

/**
 * Direct the creator to PM interface
 * @param {object} msg 
 * @param {array} result 
 * @param {object} bot 
 */
async function groupChosen(msg, result, bot) {
    // Check state
    var uid = msg.from.id,
        gid = msg.chat.id
    if (gid > 0) return
    if (!session[uid]) {
        // Check user creator status && check group enrollment status
        try {
            const record = await comlib.getRecord(gid)
            if (record)
                return await bot.sendMessage(gid, langres['errorAlreadyExist']);
            const admins = await bot.getChatAdministrators(gid)
            const is_creator = admins.some(admin => admin.user.id == uid && admin.status == 'creator')
            if (!is_creator)
                return await bot.sendMessage(gid, langres['errorNotCreator']);
            var cburl = `https://telegram.me/${_e.me.username}?start=enroll=${gid}`
            await bot.sendMessage(gid, langres['promptGroupChosen'], {
                reply_to_message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: langres['buttonGroupChosenContinue'],
                            url: cburl
                        }]
                    ]
                }
            })
            // offer button to continue && set state
            session[uid] = {
                status: 'pending_enroll_pm'
            }
            comlib.setLock(uid)
        } catch (e) {
            return errorProcess(msg, bot, e);
        }
    } else {
        return bot.sendMessage(msg.from.id, langres['infoBusyState'])
    }
}

async function groupSelected(msg, result, bot) {
    // Check in state
    var gid = result[1],
        uid = msg.from.id,
        sid = msg.chat.id
    if (session[uid] && session[uid].status == 'pending_enroll_pm' && uid == sid && gid < 0) {
        // do shit posting
        try {
            let chat = await bot.getChat(gid)
            delete chat['pinned_message']
            delete chat['all_members_are_administrators']
            delete chat['invite_link']
            session[uid] = {
                status: 'enrolling',
                argu: gid
            }
            return processEnrollWaitTag(uid, chat, msg, bot);
        } catch (e) {
            return errorProcess(msg, bot, e);
        }
    } else {
        bot.sendMessage(msg.chat.id, langres['infoMalState'])
    }
}

async function checkChannelEnrollCondition(msg, bot) {
    if (msg.chat.id < 0) return
    if (session[msg.from.id]) return
    const channel_id = msg.forward_from_chat.id
    const record = await comlib.getRecord(channel_id)
    if (record && record.creator != msg.from.id)
        return
    else if (record && record.creator == msg.from.id)
        await comlib.doRemoval(record.id)
    let user_status
    try {
        user_status = (await bot.getChatMember(channel_id, msg.from.id)).status
    } catch (e) {
        return await bot.sendMessage(msg.chat.id, langres['errorBotIsNotChannelAdmin'])
    }
    if (user_status != 'creator') {
        return await bot.sendMessage(msg.chat.id, langres['errorNotCreator'])
    }
    const channel_data = await bot.getChat(channel_id)
    delete channel_data['pinned_message']
    delete channel_data['all_members_are_administrators']
    delete channel_data['invite_link']
    session[msg.from.id] = {
        status: 'enrolling',
        argu: channel_id
    }
    comlib.setLock(msg.from.id)
    return processEnrollWaitTag(msg.from.id, channel_data, msg, bot);
}

async function processEnrollWaitTag(uid, ret, msg, bot) {
    var row = []
    var col = []
    tags.forEach((child) => {
        col.push({
            text: child
        });
        if (col.length == 3) {
            row.push(col);
            col = [];
        }
    })
    if (col.length > 0) {
        row.push(col);
        col = [];
    }
    try {
        await bot.sendMessage(uid, util.format(langres['promptSendTag'], tags.join('\n')), {
            reply_markup: {
                keyboard: row,
                one_time_keyboard: true
            }
        })
        session[uid] = {
            status: 'waitfortag',
            argu: ret
        }
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

async function processEnrollWaitDescription(uid, ret, msg, bot) {
    try {
        let message = langres['promptSendDesc']
        let options = {}
        if (ret.description) {
            message += `\n\n${langres['promptCurrentDesc']}\n${ret.description}`
            options.reply_markup = {
                inline_keyboard: [
                    [{
                        text: langres['buttonUseGroupDescription'],
                        callback_data: 'enroller_usecurrentdesc'
                    }]
                ]
            }
        }
        await bot.sendMessage(uid, message, options)
        session[uid] = {
            status: 'waitfordesc',
            argu: ret
        }
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

async function processEnrollUseCurrentDesc(msg, bot) {
    var newinfo = session[msg.from.id].argu;
    newinfo['desc'] = newinfo['description']
    if (newinfo.username) processEnrollPublic(msg.from.id, newinfo, msg, bot); // is public group
    else processEnrollPrivateWaitLink(msg.from.id, newinfo, msg, bot); // is private group
}


async function processEnrollPublic(uid, groupinfo, msg, bot) {
    try {
        var confirmtext = util.format(langres['confirmPublicGroupInfo'], groupinfo.id, groupinfo.username, groupinfo.title, groupinfo.tag, groupinfo.desc);
        groupinfo.is_public = true;
        await bot.sendMessage(uid, confirmtext, {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: langres['buttonConfirm'],
                        callback_data: 'enroller_confirm_enroll'
                    }, {
                        text: langres['buttonCancel'],
                        callback_data: 'enroller_cancel'
                    }]
                ],
                hide_keyboard: true
            }
        })
        session[uid] = {
            status: 'confirmmsg',
            argu: groupinfo
        }
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

async function processEnrollPrivateWaitLink(uid, groupinfo, msg, bot) {
    try {
        await bot.sendMessage(uid, langres['promptSendLink'])
        session[uid] = {
            status: 'waitforlink',
            argu: groupinfo
        }
    } catch (err) {
        errorProcess(msg, bot, err)
    }
}

async function processLink(msg, result, bot) {
    var link = result[1];
    if (session[msg.from.id])
        if (session[msg.from.id].status == 'waitforlink') {
            var newinfo = session[msg.from.id].argu;
            newinfo['invite_link'] = link;
            return processEnrollPrivate(msg.from.id, newinfo, msg, bot);
        }
}

async function processEnrollPrivate(uid, groupinfo, msg, bot) {
    try {
        var confirmtext = util.format(langres['confirmPrivateGroupInfo'], groupinfo.id, groupinfo.title, groupinfo.invite_link, groupinfo.tag, groupinfo.desc);
        groupinfo.is_public = false;
        await bot.sendMessage(uid, confirmtext, {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: langres['buttonConfirm'],
                        callback_data: 'enroller_confirm_enroll'
                    }, {
                        text: langres['buttonCancel'],
                        callback_data: 'enroller_cancel'
                    }]
                ],
                hide_keyboard: true
            }
        })
        session[uid] = {
            status: 'confirmmsg',
            argu: groupinfo
        }
    } catch (err) {
        errorProcess(msg, bot, err)
    }
}

function purgeState(msg, result, bot) {
    delete session[msg.from.id];
    comlib.unsetLock(msg.from.id);
    bot.sendMessage(msg.chat.id, langres['infoSessionCleared'], {
        reply_markup: {
            hide_keyboard: true
        }
    });
}

// Callback Functions

async function enrollerConfirmEnroll(msg, bot) {
    //check state
    if (session[msg.from.id] && session[msg.from.id].status == "confirmmsg") {
        var groupinfo = session[msg.from.id].argu
        groupinfo.creator = msg.from.id;
        var ret = comlib.doEnrollment(groupinfo);
        if (ret == 'new_public_queue') {
            try {
                delete session[msg.from.id];
                comlib.unsetLock(msg.from.id);
                await bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: langres['dialogPubDone'],
                    show_alert: true
                })
                return await bot.editMessageText(langres['infoPubDoneGCD'], {
                    chat_id: msg.message.chat.id,
                    message_id: msg.message.message_id
                })
            } catch (e) {
                errorProcess(msg.message, bot, e);
            }
        } else if (ret == 'new_private_queue') {
            try {
                delete session[msg.from.id];
                comlib.unsetLock(msg.from.id);
                await bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: langres['dialogPrivDone'],
                    show_alert: true
                })
                return await bot.editMessageText(langres['infoPrivDoneGCD'], {
                    chat_id: msg.message.chat.id,
                    message_id: msg.message.message_id
                })
            } catch (e) {
                errorProcess(msg.message, bot, e);
            }
        }
    }
}

async function enrollerCancel(msg, bot) {
    delete session[msg.from.id];
    comlib.unsetLock(msg.from.id);
    return await bot.editMessageText(langres['infoSessionCleared'], {
        chat_id: msg.message.chat.id,
        message_id: msg.message.message_id
    });
}

async function displayChannelManual(msg, bot) {
    bot.answerCallbackQuery({
        callback_query_id: msg.id,
        text: ''
    })
    return bot.sendMessage(msg.from.id, langres['infoHowToIndexChannel'])
}

async function processCallbackButton(msg, type, bot) {
    switch (msg.data) {
        case "enroller_confirm_enroll":
            return enrollerConfirmEnroll(msg, bot)
        case "enroller_cancel":
            return enrollerCancel(msg, bot)
        case 'enroller_usecurrentdesc':
            bot.answerCallbackQuery({
                callback_query_id: msg.id,
                text: ''
            })
            return processEnrollUseCurrentDesc(msg, bot)
        case 'enroller_manual_channel':
            return displayChannelManual(msg, bot)
    }

    // common with param

    const [operator, param] = msg.data.split(':')
    if (operator == 'upd') {
        let [category, gid] = param.split('&')
        gid = parseInt(gid)
        switch (category) {
            case 'common':
            case 'desc':
            case 'tag':
            case 'link':
            case 'ref':
        }
    }
}

// Resource Included
function generateUpdateDialog_MainPage(record) {
    let ret = {
        text: '',
        reply_markup: {}
    }
    switch (record.type) {
        case 'group':
            ret.text += '群组'
            break
        case 'supergroup':
            ret.text += '超级群组'
            break
        case 'channel':
            ret.text += '频道'
            break
    }
    ret.text += ` ${record.title}\n`
    ret.text += `类别：${record.is_public ? '公开' : '私有'}\n`
    if (record.is_public)
        ret.text += `标识：@${record.username}\n`
    else
        ret.text += `链接：${record.invite_link}\n`
    if (record.member_count)
        ret.text += `成员数：${record.member_count}\n`
    ret.text += `当前分类：#${record.tag}\n`
    ret.text += `当前简介：\n${record.desc}\n\n`
    if (record.extag && Object.keys(record.extag).length > 0) {
        ret.text += `当前启用特性：\n`
        for (let feat of Object.keys(record.extag)) {
            if (!feat.match(/^feature:/)) continue
            if (record.extag[feat]) {
                ret.text += `${feat}\n`
            }
        }
    }
    ret.text += `请选择操作：`
    let buttons = []
    if (record.is_public) {
        buttons.push([{
                text: '更新数据',
                callback_data: `upd:common&${record.id}`
            },
            {
                text: '变更分类',
                callback_data: `upd:tag&${record.id}`
            }
        ], [{
                text: '变更简介',
                callback_data: `upd:desc&${record.id}`
            },
            {
                text: '管理功能说明',
                url: 'https://wfjsw.gitbooks.io/tgcn-groupindex-reference/content/administration-functions.html'
            }
        ])
    } else {
        buttons.push([{
                text: '更新数据',
                callback_data: `upd:common&${record.id}`
            },
            {
                text: '变更分类',
                callback_data: `upd:tag&${record.id}`
            }
        ], [{
                text: '变更简介',
                callback_data: `upd:desc&${record.id}`
            },
            {
                text: '变更邀请链接',
                callback_data: `upd:link&${record.id}`
            }
        ], [{
            text: '管理功能说明',
            url: 'https://wfjsw.gitbooks.io/tgcn-groupindex-reference/content/administration-functions.html'
        }])
    }
    buttons.push([{
        text: '刷新',
        callback_data: `upd:ref&${record.id}`
    }])
    ret.reply_markup = {
        inline_keyboard: buttons
    }
    return ret
}
// End Resource Included

async function pushUpdateDialogPM(msg, result, bot) {
    try {
        const gid = parseInt(result[1])
        const uid = msg.from.id
        const record = await comlib.getRecord(gid)
        if (!record) return
        if (record.creator != uid) return
        let dialog = generateUpdateDialog_MainPage(record)
        return await bot.sendMessage(msg.chat.id, dialog.text, {
            reply_markup: dialog.reply_markup,
            disable_web_page_preview: true
        })
    } catch (e) {
        console.error(e.stack)
        return await bot.sendMessage(msg.chat.id, '无法发送控制面板。')
    }
}

async function pushUpdateDialogGroup(msg, result, bot) {
    const gid = msg.chat.id
    const uid = msg.from.id
    const record = await comlib.getRecord(gid)
    if (!record) return
    if (record.creator != uid) return
    let dialog = generateUpdateDialog_MainPage(record)
    try {
        await bot.sendMessage(uid, dialog.text, {
            reply_markup: dialog.reply_markup,
            disable_web_page_preview: true
        })
        return await bot.sendMessage(gid, '控制面板已经私聊给你了。')
    } catch (e) {
        console.error(e.stack)
        return await bot.sendMessage(gid, '无法发送控制面板。请检查您是否已将本机器人屏蔽。')
    }
}

async function updatePrivateLink(msg, result, bot) {
    if (msg.chat.id < 0) {
        var updatenotify = {
            id: msg.chat.id,
            invite_link: result[1],
            is_update: true
        };
        comlib.getRecord(msg.chat.id)
            .then(ret => {
                if (ret) {
                    if (ret.creator != msg.from.id) throw 'errorNotCreator'
                    if (updatenotify.invite_link == ret.invite_link) throw 'errorNoChanges'
                    else if (!ret.is_public && !msg.chat.username) {
                        updatenotify.title = ret.title
                        return comlib.doEnrollment(updatenotify)
                    } else if (!ret.is_public && msg.chat.username) throw 'errorPrivToPub'
                    else if (ret.is_public && !msg.chat.username) {
                        updatenotify.title = ret.title
                        updatenotify.is_public = false
                        bot.sendMessage(msg.chat.id, langres['infoPubToPrivDone'])
                        return comlib.doEnrollment(updatenotify)
                    }
                } else {
                    throw 'errorNotIndexed'
                }
            }).then(ret => {
                bot.sendMessage(msg.chat.id, langres['infoPrivDone']);
            }).catch((e) => {
                var replymark = {
                    reply_to_message_id: msg.message_id
                }
                if (e == 'errorNotCreator') bot.sendMessage(msg.chat.id, langres['errorNotCreator'], replymark);
                else if (e == 'errorNotIndexed') bot.sendMessage(msg.chat.id, langres['errorNotIndexed'], replymark);
                else if (e == 'errorNoChanges') bot.sendMessage(msg.chat.id, langres['errorNoChanges'], replymark);
                else if (e == 'errorPrivToPub') bot.sendMessage(msg.chat.id, langres['errorPrivToPub'], replymark);
                else errorProcess(msg, bot, e);
            }) // To be continued
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup']);
    }
}

function updateInfo(msg, result, bot) {
    if (msg.chat.id < 0) {
        var old_stat;
        comlib.getRecord(msg.chat.id)
            .then(ret => {
                old_stat = ret;
                if (ret)
                    if (ret.creator != msg.from.id) throw 'errorNotCreator';
                    else return _e.bot.getChat(msg.chat.id);
                else throw 'errorNotIndexed';
            })
            .then(ret => {
                var updatenotify = {
                    id: ret.id,
                    title: ret.title,
                    is_update: true
                };
                if (ret.username) {
                    updatenotify.username = ret.username;
                    updatenotify.is_public = true;
                    if (old_stat.extag) {
                        updatenotify.is_silent = old_stat.extag['silent'] || 0
                    }
                } else if (old_stat.is_public == true) {
                    throw 'errorPubToPriv'
                } else {
                    updatenotify.is_public = false;
                }
                if (old_stat.title == updatenotify.title && old_stat.username == updatenotify.username && old_stat.is_public == updatenotify.is_public)
                    throw 'errorNoChanges';
                else
                    return comlib.doEnrollment(updatenotify);
            })
            .then(ret => {
                // Process Response
                if (ret == 'new_public_queue') {
                    delete session[msg.from.id];
                    bot.sendMessage(msg.chat.id, langres['infoPubDone']);
                } else if (ret == 'new_private_queue') {
                    delete session[msg.from.id];
                    bot.sendMessage(msg.chat.id, langres['infoPrivDone']);
                }
            }).catch((e) => {
                var replymark = {
                    reply_to_message_id: msg.message_id
                }
                if (e == 'errorNotCreator') bot.sendMessage(msg.chat.id, langres['errorNotCreator'], replymark);
                else if (e == 'errorNotIndexed') bot.sendMessage(msg.chat.id, langres['errorNotIndexed'], replymark);
                else if (e == 'errorNoChanges') bot.sendMessage(msg.chat.id, langres['errorNoChanges'], replymark);
                else if (e == 'errorPubToPriv') bot.sendMessage(msg.chat.id, langres['errorPubToPriv'], replymark);
                else errorProcess(msg, bot, e);
            })
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup']);
    }
}

function enrollmentOptOut(msg, result, bot) {
    if (msg.chat.id < 0) {
        if (session[msg.chat.id] == 'optout') {
            comlib.getRecord(msg.chat.id)
                .then(ret => {
                    if (ret)
                        if (ret.creator != msg.from.id) throw 'errorNotCreator'
                    else return msg.chat.id
                    else throw 'errorNotIndexed'
                })
                .then(ret => {
                    return comlib.doRemoval(ret)
                })
                .then(ret => {
                    // Process Response
                    bot.sendMessage(msg.chat.id, langres['infoRemoved'])
                    comlib.event.emit('group_removal', msg.chat.id)
                    delete session[msg.chat.id]
                }).catch((e) => {
                    if (e == 'errorNotCreator') bot.sendMessage(msg.chat.id, langres['errorNotCreator'])
                    else if (e == 'errorNotIndexed') bot.sendMessage(msg.chat.id, langres['errorNotIndexed'])
                    else errorProcess(msg, bot, e)
                })
        } else {
            comlib.getRecord(msg.chat.id)
                .then(ret => {
                    if (ret)
                        if (ret.creator != msg.from.id) throw 'errorNotCreator'
                    else return bot.sendMessage(msg.chat.id, langres['promptRemoveConfirm'])
                    else throw 'errorNotIndexed'
                })
                .then(ret => {
                    session[msg.chat.id] = 'optout'
                })
                .catch((e) => {
                    if (e == 'errorNotCreator') bot.sendMessage(msg.chat.id, langres['errorNotCreator'])
                    else if (e == 'errorNotIndexed') bot.sendMessage(msg.chat.id, langres['errorNotIndexed'])
                    else errorProcess(msg, bot, e)
                })
        }
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup'])
    }
}

function processText(msg, type, bot) {
    var input = msg.text;
    try {
        if (session[msg.from.id]) {
            if (session[msg.from.id].status == 'waitfortag' && tags.indexOf(input) > -1) {
                var newinfo = session[msg.from.id].argu;
                newinfo['tag'] = input;
                processEnrollWaitDescription(msg.from.id, newinfo, msg, bot);
            } else if (session[msg.from.id].status == 'waitfortag' && tags.indexOf(input) == -1) {
                bot.sendMessage(msg.chat.id, util.format(langres['errorInvaildTag'], tags.join('\n')));
            } else if (session[msg.from.id].status == 'waitfordesc') {
                var newinfo = session[msg.from.id].argu;
                newinfo['desc'] = input;
                if (newinfo.username) processEnrollPublic(msg.from.id, newinfo, msg, bot); // is public group
                else processEnrollPrivateWaitLink(msg.from.id, newinfo, msg, bot); // is private group
            }
        } else if (msg.forward_from_chat) {
            return checkChannelEnrollCondition(msg, bot)
        }
    } catch (e) {
        errorProcess(msg, bot, e);
    }
}

function updateTag(msg, result, bot) {
    if (msg.chat.id < 0) {
        var old_stat;
        var tag = result[1];
        if (tags.indexOf(tag) > -1) {
            comlib.getRecord(msg.chat.id)
                .then(ret => {
                    if (ret)
                        if (ret.creator != msg.from.id) throw 'errorNotCreator';
                        else {
                            old_stat = ret
                            return _e.bot.getChat(msg.chat.id)
                        }
                    else throw 'errorNotIndexed';
                })
                .then(ret => {
                    var updatenotify = {
                        id: ret.id,
                        tag: tag,
                        is_update: true
                    };
                    if (ret.username) {
                        updatenotify.username = ret.username;
                        updatenotify.is_public = true;
                    } else {
                        updatenotify.is_public = false;
                    }
                    if (old_stat.tag == updatenotify.tag && old_stat.is_public == updatenotify.is_public)
                        throw 'errorNoChanges';
                    else
                        return comlib.doEnrollment(updatenotify);
                })
                .then(ret => {
                    // Process Response
                    if (ret == 'new_public_queue') {
                        delete session[msg.from.id];
                        bot.sendMessage(msg.chat.id, langres['infoPubDone']);
                    } else if (ret == 'new_private_queue') {
                        delete session[msg.from.id];
                        bot.sendMessage(msg.chat.id, langres['infoPrivDone']);
                    }
                }).catch((e) => {
                    if (e == 'errorNotCreator') bot.sendMessage(msg.chat.id, langres['errorNotCreator']);
                    else if (e == 'errorNotIndexed') bot.sendMessage(msg.chat.id, langres['errorNotIndexed']);
                    else if (e == 'errorNoChanges') bot.sendMessage(msg.chat.id, langres['errorNoChanges']);
                    else errorProcess(msg, bot, e);
                })
        } else {
            bot.sendMessage(msg.chat.id, util.format(langres['errorInvaildTag'], tags.join('\n')));
        }
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup']);
    }
}

function updateDesc(msg, result, bot) {
    if (msg.chat.id < 0) {
        var old_stat;
        var desc = result[1];
        comlib.getRecord(msg.chat.id)
            .then(ret => {
                old_stat = ret;
                if (ret)
                    if (ret.creator != msg.from.id) throw 'errorNotCreator';
                    else return _e.bot.getChat(msg.chat.id);
                else throw 'errorNotIndexed';
            })
            .then(ret => {
                var updatenotify = {
                    id: ret.id,
                    desc: desc,
                    is_update: true
                };
                if (ret.username) {
                    updatenotify.username = ret.username;
                    updatenotify.is_public = true;
                } else {
                    updatenotify.is_public = false;
                }
                if (old_stat.tag == updatenotify.tag && old_stat.is_public == updatenotify.is_public)
                    throw 'errorNoChanges';
                else
                    return comlib.doEnrollment(updatenotify);
            })
            .then(ret => {
                // Process Response
                if (ret == 'new_public_queue') {
                    delete session[msg.from.id];
                    bot.sendMessage(msg.chat.id, langres['infoPubDone']);
                } else if (ret == 'new_private_queue') {
                    delete session[msg.from.id];
                    bot.sendMessage(msg.chat.id, langres['infoPrivDone']);
                }
            }).catch((e) => {
                if (e == 'errorNotCreator') bot.sendMessage(msg.chat.id, langres['errorNotCreator']);
                else if (e == 'errorNotIndexed') bot.sendMessage(msg.chat.id, langres['errorNotIndexed']);
                else if (e == 'errorNoChanges') bot.sendMessage(msg.chat.id, langres['errorNoChanges']);
                else errorProcess(msg, bot, e);
            })
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup']);
    }
}

function missingParameter(msg, result, bot) {
    if (msg.chat.id < 0) {
        bot.sendMessage(msg.chat.id, '请在指令后面跟上要更新的内容，例如链接、标签或简介', {
            reply_to_message_id: msg.message_id
        });
    }
}

module.exports = {
    init: (e) => {
        _e = e
        comlib = _e.libs['gpindex_common']
        _ga = _e.libs['ga']
    },
    run: [
        [/^\/enroll/, startEnrollment],
        [/^\/start grpselect$/, groupChosen],
        [/^\/start@.+ grpselect$/, groupChosen],
        [/^\/start enroll=(-[0-9]{6,})$/, groupSelected],
        [/^\/start panel=(-[0-9]{6,})$/, pushUpdateDialogPM],
        [/^\/cancel$/, purgeState],
        ['callback_query', processCallbackButton],
        [/^(https:\/\/telegram.me\/joinchat\/.+)$/, processLink],
        [/^(https:\/\/t.me\/joinchat\/.+)$/, processLink],
        //[/^(http:\/\/telegra.ph\/.+)$/, processLink],
        [/^\/grouplink_update (https:\/\/telegram.me\/joinchat\/.+)$/, updatePrivateLink],
        [/^\/grouplink_update (https:\/\/t.me\/joinchat\/.+)$/, updatePrivateLink],
        [/^\/grouplink_update$/, missingParameter],
        //[/^\/grouplink_update (http:\/\/telegra.ph\/.+)$/, updatePrivateLink],
        [/^\/update$/, updateInfo],
        [/^\/panel$/, pushUpdateDialogGroup],
        [/^\/tag_update (.+)$/, updateTag],
        [/^\/tag_update$/, missingParameter],
        [/^\/desc_update ((?:.|\n)+)/m, updateDesc],
        [/^\/desc_update$/, missingParameter],
        [/^\/remove$/, enrollmentOptOut],
        ['text', processText]
    ]
}
