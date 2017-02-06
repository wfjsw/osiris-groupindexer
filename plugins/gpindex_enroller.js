'use strict';

const util = require('util');

const admin_id = require('../config.json')['gpindex_admin'];

var langres = require('../resources/gpindex_enroller.json');
var session = {};
var _e, comlib;
var tags = require('../config.json')['gpindex_tags'];


function errorProcess(msg, bot, err) {
    var errorlog = '```\n' + util.inspect(err) + '```\n';
    console.error(err);
    bot.sendMessage(msg.chat.id, langres['infoBugReport']);
    bot.sendMessage(admin_id, errorlog, {
        parse_mode: 'Markdown'
    });
    purgeState(msg, 'errrpt', bot);
}

function startEnrollment(msg, result, bot){
    // Check state
    if (!session[msg.from.id] && msg.chat.id > 0) {
        // Prompt user to choose group
        var cburl = util.format('https://telegram.me/%s?startgroup=%s', _e.me.username, 'grpselect');
        bot.sendMessage(msg.from.id, langres['promptChooseGroup'], {
            reply_to_message_id: msg.message_id,
            reply_markup: {inline_keyboard:[[{ text: langres['buttonChooseGroup'], url: cburl }]]}
        }).catch((err) => {
            errorProcess(msg, bot, err)
        })
    } else {
        bot.sendMessage(msg.from.id, langres['infoBusyState'])
    }
    
}

function groupChosen(msg, result, bot){
    // Check state
    var uid = msg.from.id,
        gid = msg.chat.id;
    if (!session[uid] && gid < 0) {
        // Check user creator status && check group enrollment status
        comlib.getRecord(gid)
        .then((ret) => {
            if (ret) {
                throw 'errorAlreadyExist';
            } else {
                return bot.getChatAdministrators(gid)
            }
        })
        .then((ret) => {
            var isadmin = false;
            ret.forEach((child)=> {
                if (child.user.id == uid && child.status == 'creator') isadmin = true;
            });
            return isadmin;
        }).then((ret) => {
            var cburl = util.format('https://telegram.me/%s?start=enroll@%d', _e.me.username, gid);
            if (ret) {
                bot.sendMessage(gid, langres['promptGroupChosen'], {
                    reply_to_message_id: msg.message_id,
                    reply_markup: {inline_keyboard:[[{ text: langres['buttonGroupChosenContinue'], url: cburl }]]}
                }); // offer button to continue && set state
                session[uid] = {status: 'pending_enroll_pm'};
                comlib.setLock(uid);
            }
            else {bot.sendMessage(gid, langres['errorNotCreator']);} // reject
        }).catch((err) => {
            if (err == 'errorAlreadyExist') bot.sendMessage(gid, langres['errorAlreadyExist']);
            else errorProcess(msg,bot,err);
        })
    } else {
        bot.sendMessage(msg.from.id, langres['infoBusyState'])
    }
}

function groupSelected(msg, result, bot) {
    // Check in state
    var gid = result[1],
        uid = msg.from.id,
        sid = msg.chat.id;
    if (session[uid] && session[uid].status == 'pending_enroll_pm' && uid == sid && gid < 0) {
        // do shit posting
        bot.getChat(gid)
        .then((ret) => {
            processEnrollWaitTag(uid, ret, msg, bot);
            session[uid] = {status: 'enrolling', argu: gid};
        })
    } else {
        bot.sendMessage(msg.chat.id, langres['infoMalState'])
    }
}

function processEnrollWaitTag(uid, ret, msg, bot) {
    var row = [], i = 0;
    var col = [];
    tags.forEach((child) => {
        col.push({text: child});
        if (col.length == 3) {
            row.push(col);
            col = [];
        }
    })
    if (col.length > 0) {
        row.push(col);
        col = [];
    }
    bot.sendMessage(uid, util.format(langres['promptSendTag'], tags.join('\n')), {
        reply_markup: {keyboard: row, one_time_keyboard: true}
    })
    .then((msg) => {
        session[uid] = {status: 'waitfortag', argu: ret};
    }).catch((err) => {
        errorProcess(msg, bot, err)
    });
}

function processEnrollWaitDescription(uid, ret, msg, bot) {
    bot.sendMessage(uid, langres['promptSendDesc'], {
        reply_markup: {force_reply: true}
    })
    .then((msg) => {
        session[uid] = {status: 'waitfordesc', argu: ret};
    }).catch((err) => {
        errorProcess(msg, bot, err)
    });
}

function processEnrollPublic(uid, groupinfo, msg, bot) {
    var confirmtext = util.format(langres['confirmPublicGroupInfo'], groupinfo.id, groupinfo.username, groupinfo.title, groupinfo.tag, groupinfo.desc);
    groupinfo.is_public = true;
    bot.sendMessage(uid, confirmtext, {
        reply_markup: {inline_keyboard:[[{ text: langres['buttonConfirm'], callback_data: 'enroller_confirm_enroll' }, { text: langres['buttonCancel'], callback_data: 'enroller_cancel' }]]}
    }).then((msg) => {
        session[uid] = {status: 'confirmmsg', argu: groupinfo};
    }).catch((err) => {
        errorProcess(msg, bot, err)
    });
}

function processEnrollPrivateWaitLink(uid, groupinfo, msg, bot) {
    bot.sendMessage(uid, langres['promptSendLink'], {
        reply_markup: {force_reply: true}
    })
    .then((msg) => {
        session[uid] = {status: 'waitforlink', argu: groupinfo};
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
        reply_markup: {inline_keyboard:[[{ text: langres['buttonConfirm'], callback_data: 'enroller_confirm_enroll' }, { text: langres['buttonCancel'], callback_data: 'enroller_cancel' }]]}
    }).then((msg) => {
        session[uid] = {status: 'confirmmsg', argu: groupinfo};
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



function processCallbackButton(msg, type, bot){
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
                    bot.answerCallbackQuery(msg.id, langres['infoPubDone'], true)
                    .then((ret) => {
                        return bot.editMessageText(langres['infoPubDone'], {
                            chat_id: msg.message.chat.id,
                            message_id: msg.message.message_id
                        })
                    }).catch((e) => {
                        errorProcess(msg.message, bot, e);
                    });
                } else if (ret == 'new_private_queue') {
                    delete session[msg.from.id];
                    comlib.unsetLock(msg.from.id);
                    bot.answerCallbackQuery(msg.id, langres['infoPrivDone'], true)
                    .then((ret) => {
                        return bot.editMessageText(langres['infoPrivDone'], {
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
            bot.editMessageText(langres['infoSessionCleared'], {
                chat_id: msg.message.chat.id,
                message_id: msg.message.message_id 
            });
    }
} 

function updatePrivateLink(msg, result, bot) {
    if (msg.chat.id < 0) {
        var updatenotify = {
            id: msg.chat.id,
            invite_link: result[1],
            is_update: true
        };
        bot.getChatAdministrators(msg.chat.id)
        .then((ret) => {
            var isadmin = false;
            ret.forEach((child)=>{
                if (child.user.id == msg.from.id && child.status == 'creator') isadmin = true
            });
            if (isadmin) return comlib.getRecord(msg.chat.id);
        })
        .then((ret) => {
            if (ret && !ret.is_public) {
                updatenotify.title = ret.title;
                return comlib.doEnrollment(updatenotify);
            } else if (ret && ret.is_public && !msg.chat.username) {
                updatenotify.title = ret.title;
		updatenotify.is_public = false;
                bot.sendMessage(msg.chat.id, langres['infoPubToPrivDone']);
                return comlib.doEnrollment(updatenotify);
            } else {
                bot.sendMessage(msg.chat.id, langres['errorNotIndexed']);
            }
        }).then((ret) => {
            bot.sendMessage(msg.chat.id, langres['infoPrivDone']);
        }).catch((e) => {
            errorProcess(msg, bot, e);
        }) // To be continued
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup']);
    }
}

function updateInfo(msg, result, bot) {
    if (msg.chat.id < 0) {
        var old_stat;
        comlib.getRecord(msg.chat.id)
        .then((ret) => {
            old_stat = ret;
            if (ret) 
                if (ret.creator != msg.from.id) throw 'errorNotCreator';
                else return bot.getChat(msg.chat.id);
            else throw 'errorNotIndexed';
        })
        .then((ret) => {
            var updatenotify = {
                id: ret.id,
                title: ret.title,
                is_update: true    
            };
            if (ret.username) {
                updatenotify.username = ret.username;
                updatenotify.is_public = true;
            } else {
                updatenotify.is_public = false;
            }
            if (old_stat.title == updatenotify.title && old_stat.username == updatenotify.username && old_stat.is_public == updatenotify.is_public)
                throw 'errorNoChanges';
            else 
                return comlib.doEnrollment(updatenotify);
        })
        .then((ret) => {
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

function enrollmentOptOut(msg, result, bot) {
    if (msg.chat.id < 0) {
        if (session[msg.chat.id] == 'optout') {
            comlib.getRecord(msg.chat.id)
            .then((ret) => {
                if (ret) 
                    if (ret.creator != msg.from.id) throw 'errorNotCreator';
                    else return msg.chat.id;
                else throw 'errorNotIndexed';
            })
            .then((ret) => {
                return comlib.doRemoval(ret);
            })
            .then((ret) => {
                // Process Response
                bot.sendMessage(msg.chat.id, langres['infoPubDone']);
                comlib.event.emit('group_removal', msg.chat.id);
                delete session[msg.chat.id];
            }).catch((e) => {
                if (e == 'errorNotCreator') bot.sendMessage(msg.chat.id, langres['errorNotCreator']);
                else if (e == 'errorNotIndexed') bot.sendMessage(msg.chat.id, langres['errorNotIndexed']);
                else errorProcess(msg, bot, e);
            })
        } else {
            bot.getChatAdministrators(msg.chat.id)
            .then((ret) => {
            var isadmin = false
               ret.forEach((child)=>{
                    if (child.user.id == msg.from.id && child.status == 'creator') isadmin = true;
                });
                return isadmin;
            })
            .then((ret) => {
                if (ret) return comlib.getRecord(msg.chat.id);
                else bot.sendMessage(msg.chat.id, langres['errorNotCreator']); // reject
            })
            .then((ret) => {
                if (ret) {
                    return bot.sendMessage(msg.chat.id, langres['promptRemoveConfirm']);
                } else {
                    bot.sendMessage(msg.chat.id, langres['errorNotIndexed']);
                }
            })
            .then((ret) => {
                session[msg.chat.id] = 'optout';
            })
            .catch((e) => {
                errorProcess(msg, bot, e);
            })
        }
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup']);
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
    } catch(e) {
        errorProcess(msg, bot, e);
    }
}

function updateTag(msg, result, bot) {
    if (msg.chat.id < 0) {
        var old_stat;
        var tag = result[1];
        if (tags.indexOf(tag) > -1) {
            comlib.getRecord(msg.chat.id)
            .then((ret) => {
                if (ret) 
                    if (ret.creator != msg.from.id) throw 'errorNotCreator';
                    else {
                        old_stat = ret
                        return bot.getChat(msg.chat.id)
                    }
                else throw 'errorNotIndexed';
            })
            .then((ret) => {
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
            .then((ret) => {
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
        .then((ret) => {
            old_stat = ret;
            if (ret) 
                if (ret.creator != msg.from.id) throw 'errorNotCreator';
                else return bot.getChat(msg.chat.id);
            else throw 'errorNotIndexed';
        })
        .then((ret) => {
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
        .then((ret) => {
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

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
    },
    run: [
        [/^\/enroll/, startEnrollment],
        [/^\/start grpselect$/, groupChosen],
        [/^\/start@.+ grpselect$/, groupChosen],
        [/^\/start enroll@([0-9-]{6,})$/, groupSelected],
        [/^\/cancel$/, purgeState],
        ['callback_query', processCallbackButton],
        [/^(https:\/\/telegram.me\/joinchat\/.+)$/, processLink],
        [/^(https:\/\/t.me\/joinchat\/.+)$/, processLink],
        //[/^(http:\/\/telegra.ph\/.+)$/, processLink],
        [/^\/grouplink_update (https:\/\/telegram.me\/joinchat\/.+)$/, updatePrivateLink],
        [/^\/grouplink_update (https:\/\/t.me\/joinchat\/.+)$/, updatePrivateLink],
        //[/^\/grouplink_update (http:\/\/telegra.ph\/.+)$/, updatePrivateLink],
        [/^\/update$/, updateInfo],
        [/^\/tag_update (.+)$/, updateTag],
        [/^\/desc_update ((?:.|\n)+)/m, updateDesc],
        [/^\/remove$/, enrollmentOptOut],
        ['text', processText]
    ]
}
