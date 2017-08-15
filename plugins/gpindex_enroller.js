const util = require('util');

const admin_id = require('../config.gpindex.json')['gpindex_admin'];

var langres = require('../resources/gpindex_enroller.json');
var session = {};
var _e, comlib, _ga
var tags = require('../config.gpindex.json')['gpindex_tags'];

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

async function startEnrollment(msg, result, bot) {
    // Check state
    if (!session[msg.from.id]) {
        if (msg.chat.id > 0) {
            try {
                const is_validated = await comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
                const is_blocked = await comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
                if (is_validated) {
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
                                        url: langres['linkChannelReadme']
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
            comlib.setLock(uid);
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
            const chat = await bot.getChat(gid)
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
                inline_keyboard: [[{
                    text: langres['buttonUseGroupDescription'],
                    callback_data: 'enroller_usecurrentdesc'
                }]]
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

function processEnrollPrivateWaitLink(uid, groupinfo, msg, bot) {
    bot.sendMessage(uid, langres['promptSendLink'])
        .then((msg) => {
            session[uid] = {
                status: 'waitforlink',
                argu: groupinfo
            };
        }).catch((err) => {
            errorProcess(msg, bot, err)
        });
}

function processLink(msg, result, bot) {
    var link = result[1];
    if (session[msg.from.id])
        if (session[msg.from.id].status == 'waitforlink') {
            var newinfo = session[msg.from.id].argu;
            newinfo['invite_link'] = link;
            processEnrollPrivate(msg.from.id, newinfo, msg, bot);
        }
}

function processEnrollPrivate(uid, groupinfo, msg, bot) {
    var confirmtext = util.format(langres['confirmPrivateGroupInfo'], groupinfo.id, groupinfo.title, groupinfo.invite_link, groupinfo.tag, groupinfo.desc);
    groupinfo.is_public = false;
    bot.sendMessage(uid, confirmtext, {
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
    }).then((msg) => {
        session[uid] = {
            status: 'confirmmsg',
            argu: groupinfo
        };
    }).catch((err) => {
        errorProcess(msg, bot, err)
    });
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



async function processCallbackButton(msg, type, bot) {
    switch (msg.data) {
        case "enroller_confirm_enroll":
            //check state
            if (session[msg.from.id] && session[msg.from.id].status == "confirmmsg") {
                var groupinfo = session[msg.from.id].argu
                groupinfo.creator = msg.from.id;
                var ret = comlib.doEnrollment(groupinfo);
                if (ret == 'new_public_queue') {
                    delete session[msg.from.id];
                    comlib.unsetLock(msg.from.id);
                    bot.answerCallbackQuery(msg.id, langres['dialogPubDone'], true)
                        .then(ret => {
                            return bot.editMessageText(langres['infoPubDoneGCD'], {
                                chat_id: msg.message.chat.id,
                                message_id: msg.message.message_id
                            })
                        }).catch((e) => {
                            errorProcess(msg.message, bot, e);
                        });
                } else if (ret == 'new_private_queue') {
                    delete session[msg.from.id];
                    comlib.unsetLock(msg.from.id);
                    return bot.answerCallbackQuery(msg.id, langres['dialogPrivDone'], true)
                        .then(ret => {
                            return bot.editMessageText(langres['infoPrivDoneGCD'], {
                                chat_id: msg.message.chat.id,
                                message_id: msg.message.message_id
                            })
                        }).catch((e) => {
                            errorProcess(msg.message, bot, e);
                        });
                }
            }
            break;
        case "enroller_cancel":
            delete session[msg.from.id];
            comlib.unsetLock(msg.from.id);
            return bot.editMessageText(langres['infoSessionCleared'], {
                chat_id: msg.message.chat.id,
                message_id: msg.message.message_id
            });
        case 'enroller_usecurrentdesc': 
            bot.answerCallbackQuery(msg.id, '')    
            return processEnrollUseCurrentDesc(msg, bot)    
                
    }
}

function updatePrivateLink(msg, result, bot) {
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
        if (session[msg.from.id])
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
        [/^\/start enroll=([0-9-]{6,})$/, groupSelected],
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
        [/^\/tag_update (.+)$/, updateTag],
        [/^\/tag_update$/, missingParameter],
        [/^\/desc_update ((?:.|\n)+)/m, updateDesc],
        [/^\/desc_update$/, missingParameter],
        [/^\/remove$/, enrollmentOptOut],
        ['text', processText]
    ]
}
