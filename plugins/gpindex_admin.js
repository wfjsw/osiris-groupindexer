'use strict';

const admin_id = require('../config.json')['gpindex_admin'];
const channel_id = require('../config.json')['gpindex_channel'];
const util = require('util');
const moment = require('moment');

var alt_bot = new (require('../libtelegrambot'))(require('../config.json')["api-key"])

var _e, comlib;

function writeMenu(msg, result, bot) {

}

function addCategory(msg, result, bot) {
    // TODO
}

function removeItem(msg, result, bot) {
    if (msg.chat.id == admin_id)
        comlib.doRemoval(result[1])
        .then((ret) => {
            bot.sendMessage(msg.chat.id, 'Success');
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, 'Failed\n\n' + util.inspect(e));
        })
}

function markInvaild(msg, result, bot) {
    if (msg.chat.id == admin_id)
        comlib.getRecord(result[1])
        .then((ret) => {
            if (ret) {
                return bot.sendMessage(ret.creator, '您的群组 ' + ret.title + ' 链接已过期，请及时更新。');
            } else {
                bot.sendMessage(msg.chat.id, 'Not Found');
                throw ret;
            }
        }).then((ret) => {
            bot.sendMessage(msg.chat.id, 'Done.');
        }).catch((e) => {
            bot.sendMessage(msg.chat.id, 'Failed\n\n' + util.inspect(e));
        })
}

function doPublish(msg, result, bot) {
    if (msg.chat.id == admin_id)
        comlib.getRecord(result[1])
        .then((ret) => {
            if (ret) {
                if (ret.is_public) comlib.event.emit('new_public_commit', ret);
                else comlib.event.emit('new_private_commit', ret);
            } else {
                bot.sendMessage(msg.chat.id, 'Not Found');
                throw ret;
            }
        }).then((ret) => {
            bot.sendMessage(msg.chat.id, 'Done.');
        }).catch((e) => {
            bot.sendMessage(msg.chat.id, 'Failed\n\n' + util.inspect(e));
        })
}

function doImportPublicGroup(msg, result, bot) {
    var gname = result[1];
    var tag = result[2];
    var desc = result[3];
    var ginfo;
    if (msg.chat.id == admin_id)
    if (gname && tag && desc)
        alt_bot.getChat(gname)
        .then((ret) => {
            ginfo = ret;
            return comlib.getRecord(ret.id)
        })
        .then((ret) => {
            if (ret) {
                throw {err: 'errorAlreadyExist'};
            } else {
                return alt_bot.getChatAdministrators(ginfo.id)
            }
        }).then((ret) => {
            ret.forEach((child)=> {
                if (child.status == 'creator') ginfo.creator = child.user.id;
            });
            if (ginfo.creator) {
                ginfo.is_public = true;
                ginfo.tag = tag;
                ginfo.desc = desc;
                return comlib.silentInsert(ginfo);
            } else throw {err: 'cannotConfirmCreator'}; 
        }).then((ret) => {
            bot.sendMessage(msg.chat.id, util.inspect(ret) + '\n\n' + util.inspect(ginfo));
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, 'Failed\n\n' + util.inspect(e));
        });
    else bot.sendMessage(msg.chat.id, 'Failed to parse Input' + util.inspect(result));
}

function doTagMove(msg, result, bot) {
    if (msg.chat.id == admin_id) { 
        var gid = result[1], newtag = result[2];
	    comlib.getRecord(gid)
        .then((ret) => {
            if (ret) {
                return comlib.silentUpdate(gid, {tag: newtag})
            } else {
                bot.sendMessage(msg.chat.id, 'Not Found');
                throw ret;
            }
        }).then((ret) => {
            bot.sendMessage(msg.chat.id, 'Done. \n\n' + util.inspect(ret));
        }).catch((e) => {
            bot.sendMessage(msg.chat.id, 'Failed\n\n' + util.inspect(e));
        })
    }
}

function doRemoveFeedByID(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        var fid = result[1];
        bot.editMessageText('*** 群组信息不可用 ***', {
            chat_id: channel_id,
            message_id: fid
        }).then((ret) => {
            bot.sendMessage(msg.chat.id, 'Done. \n\n' + util.inspect(ret));
        }).catch((e) => {
            bot.sendMessage(msg.chat.id, 'Failed\n\n' + util.inspect(e));
        })
    }
}

function getChat(msg, result, bot){
    if (msg.chat.id == admin_id)
        alt_bot.getChat(parseInt(result[1]))
        .then((ret) => {
            bot.sendMessage(msg.chat.id, util.inspect(ret));
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, util.inspect(e));
        })
}

function doForceUpdate(msg, result, bot) {
    if (msg.chat.id == admin_id)
        alt_bot.getChat(parseInt(result[1]))
        .then((ret) => {
            var updation = {
                title: ret.title
            }
            if (ret.username) {
                updation.username = ret.username
                updation.is_public = true
            } else {
                updation.is_public = false
            }
            return comlib.silentUpdate(ret.id, updation)
        })
        .then((ret) => {
            bot.sendMessage(msg.chat.id, util.inspect(ret));
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, util.inspect(e));
        });
}

function getUserFlag(msg, result, bot) {
    if (msg.chat.id == admin_id)
        comlib.UserFlag.queryUserFlag(result[1], result[2])
        .then((ret) => {
            bot.sendMessage(msg.chat.id, util.inspect(ret));
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, util.inspect(e));
        });
}

function setUserFlag(msg, result, bot) {
    if (msg.chat.id == admin_id) {
        var value = result[3];
        // There are some extra things to be done for flag 'spam'
        if (result[2] == 'spam') {
            value = moment().add(moment.duration(result[3].toUpperCase())).unix();
        }
        comlib.UserFlag.setUserFlag(result[1], result[2], parseInt(value))
        .then((ret) => {
            bot.sendMessage(msg.chat.id, util.inspect(ret));
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, util.inspect(e));
        });
    }
}

function getGroupExTag(msg, result, bot) {
    if (msg.chat.id == admin_id)
        comlib.GroupExTag.queryGroupExTag(result[1], result[2])
        .then((ret) => {
            bot.sendMessage(msg.chat.id, util.inspect(ret));
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, util.inspect(e));
        });
}

function setGroupExTag(msg, result, bot) {
    if (msg.chat.id == admin_id)
        comlib.GroupExTag.setGroupExTag(result[1], result[2], parseInt(result[3]))
        .then((ret) => {
            bot.sendMessage(msg.chat.id, util.inspect(ret));
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, util.inspect(e));
        });
}


module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
    },
    run: [
        [/^\/publish ([0-9-]{6,})$/, doPublish],
        [/^\/addcategory (.*)$/, addCategory],
        [/^\/removeitem ([0-9-]{6,})$/, removeItem],
        [/^\/markinvalid ([0-9-]{6,})$/, markInvaild],
        [/^\/import_pub (@[_A-Za-z0-9]{4,}) ([^\n\s]+) ((?:.|\n)+)/m, doImportPublicGroup],
        [/^\/tagmove ([0-9-]{6,}) ([^\n\s]+)$/, doTagMove],
        [/^\/rmfeedid ([0-9]{1,})$/, doRemoveFeedByID],
        [/^\/rmfeedid https:\/\/(?:telegram.me|t.me)\/[_A-Za-z0-9]{4,}\/([0-9]{1,})$/, doRemoveFeedByID],
        [/^\/getchat ([0-9-]{6,})$/, getChat],
        [/^\/forceupdate ([0-9-]{6,})$/, doForceUpdate],
        [/^\/getflag ([0-9-]{6,}) ([^\s]+)$/, getUserFlag],
        [/^\/setflag ([0-9-]{6,}) ([^\s]+) ([^\s]+)$/, setUserFlag],
        [/^\/getextag ([0-9-]{6,}) ([^\s]+)$/, getGroupExTag],
        [/^\/setextag ([0-9-]{6,}) ([^\s]+) ([^\s]+)$/, setGroupExTag]
    ]
}
