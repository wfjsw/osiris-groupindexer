'use strict';

const util = require('util');

const admin_id = require('../config.json')['gpindex_admin'];

var langres = require('../resources/gpindex_enroller.json');
var session = {};
var _e;
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
        _e.libs['gpindex_common'].getRecord(gid)
        .then((ret) => {
            if (ret) {
                throw 'errAlreadyExist';
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
		            reply_markup: {inline_keyboard:[[{ text: langres['buttonGroupChosenContinue'], url: cburl }]]}
                }); // offer button to continue && set state
                session[uid] = {status: 'pending_enroll_pm'};
                _e.libs['gpindex_common'].setLock(uid);
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
    bot.sendMessage(uid, util.format(langres['promptSendTag'], util.inspect(tags)))
    .then((msg) => {
        session[uid] = {status: 'waitfortag', argu: ret};
    }).catch((err) => {
        errorProcess(msg, bot, err)
    });
}

function processEnrollWaitDescription(uid, ret, msg, bot) {
    bot.sendMessage(uid, langres['promptSendDesc'])
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
    bot.sendMessage(uid, langres['promptSendLink'])
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
    _e.libs['gpindex_common'].unsetLock(msg.from.id);
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
                var ret = _e.libs['gpindex_common'].doEnrollment(groupinfo);
                if (ret == 'new_public_queue') {
                    delete session[msg.from.id];
                    _e.libs['gpindex_common'].unsetLock(msg.from.id);
                    bot.sendMessage(msg.message.chat.id, langres['infoPubDone']);
                } else if (ret == 'new_private_queue') {
                    delete session[msg.from.id];
                    _e.libs['gpindex_common'].unsetLock(msg.from.id);
                    bot.sendMessage(msg.message.chat.id, langres['infoPrivDone']);
                }
            }
            break;
        case "enroller_cancel":
            delete session[msg.from.id];
            _e.libs['gpindex_common'].unsetLock(msg.from.id);
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
        // forget to check admin
        bot.getChatAdministrators(msg.chat.id)
        .then((ret) => {
            var isadmin = false;
            ret.forEach((child)=>{
                if (child.user.id == msg.from.id && child.status == 'creator') isadmin = true
            });
            if (isadmin) return _e.libs['gpindex_common'].getRecord(msg.chat.id);
        })
        .then((ret) => {
            if (ret && !ret.is_public) {
                updatenotify.title = ret.title;
                return _e.libs['gpindex_common'].doEnrollment(updatenotify);
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
        bot.getChatAdministrators(msg.chat.id)
        .then((ret) => {
            var isadmin = false;
            ret.forEach((child)=>{
                if (child.user.id == msg.from.id && child.status == 'creator') isadmin = true;
            });
            return isadmin;
        })
        .then((ret) => {
            if (ret) return _e.libs['gpindex_common'].getRecord(msg.chat.id);
            else throw 'errorNotCreator'; // reject
        })
        .then((ret) => {
            if (ret) return bot.getChat(msg.chat.id);
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
            return _e.libs['gpindex_common'].doEnrollment(updatenotify);
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
            else errorProcess(msg, bot, e);
        })
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup']);
    }
}

function enrollmentOptOut(msg, result, bot) {
    if (msg.chat.id < 0) {
        if (session[msg.chat.id] == 'optout') {
            bot.getChatAdministrators(msg.chat.id)
            .then((ret) => {
                var isadmin = false;
                ret.forEach((child)=>{
                    if (child.user.id == msg.from.id && child.status == 'creator') isadmin = true;
                });
                return isadmin;
            })
            .then((ret) => {
                if (ret) return _e.libs['gpindex_common'].getRecord(msg.chat.id);
                else throw 'errorNotCreator'; // reject
            })
            .then((ret) => {
                if (ret) {
                    return msg.chat.id;
                } else {
                    throw 'errorNotIndexed';
                }
            })
            .then((ret) => {
                return _e.libs['gpindex_common'].doRemoval(ret);
            })
            .then((ret) => {
                // Process Response
                bot.sendMessage(msg.chat.id, langres['infoPubDone']);
                _e.libs['gpindex_common'].event.emit('group_removal', msg.chat.id);
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
                if (ret) return _e.libs['gpindex_common'].getRecord(msg.chat.id);
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
                bot.sendMessage(msg.chat.id, util.format(langres['errorInvaildTag'], util.inspect(tags)));
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
        var tag = result[1];
        if (tags.indexOf(tag) > -1) {
            bot.getChatAdministrators(msg.chat.id)
            .then((ret) => {
                var isadmin = false;
                ret.forEach((child)=>{
                    if (child.user.id == msg.from.id && child.status == 'creator') isadmin = true;
                });
                return isadmin;
            })
            .then((ret) => {
                if (ret) return _e.libs['gpindex_common'].getRecord(msg.chat.id);
                else throw 'errorNotCreator'; // reject
            })
            .then((ret) => {
                if (ret) return bot.getChat(msg.chat.id);
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
                return _e.libs['gpindex_common'].doEnrollment(updatenotify);
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
                else errorProcess(msg, bot, e);
            })
        } else {
            bot.sendMessage(msg.chat.id, util.format(langres['errorInvaildTag'], util.inspect(tags)));
        }   
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup']);
    }
}

function updateDesc(msg, result, bot) {
    if (msg.chat.id < 0) {
        var desc = result[1];
        bot.getChatAdministrators(msg.chat.id)
        .then((ret) => {
            var isadmin = false;
            ret.forEach((child)=>{
                if (child.user.id == msg.from.id && child.status == 'creator') isadmin = true;
            });
            return isadmin;
        })
        .then((ret) => {
            if (ret) return _e.libs['gpindex_common'].getRecord(msg.chat.id);
            else {
                throw 'errorNotCreator'
            }
        })
        .then((ret) => {
            if (ret) return bot.getChat(msg.chat.id);
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
            return _e.libs['gpindex_common'].doEnrollment(updatenotify);
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
            else errorProcess(msg, bot, e);
        })
    } else {
        bot.sendMessage(msg.chat.id, langres['errorNotInGroup']);
    }
}

module.exports = {
    init: (e) => {
        _e = e;
    },
    run: [
        [/^\/enroll/, startEnrollment],
        [/^\/start grpselect$/, groupChosen],
        [/^\/start@.+ grpselect$/, groupChosen],
        [/^\/start enroll@([0-9-]{6,})$/, groupSelected],
        [/^\/cancel$/, purgeState],
        ['callback_query', processCallbackButton],
        [/^(https:\/\/telegram.me\/joinchat\/.+)$/, processLink],
        [/^\/grouplink_update (https:\/\/telegram.me\/joinchat\/.+)/, updatePrivateLink],
        [/^\/update$/, updateInfo],
        [/^\/tag_update (.+)$/, updateTag],
        [/^\/desc_update ((?:.|\n)+)/m, updateDesc],
        [/^\/remove$/, enrollmentOptOut],
        ['text', processText]
    ]
}
