'use strict';

const admin_id = require('../config.json')['gpindex_admin'];
const channel_id = require('../config.json')['gpindex_channel'];
const util = require('util');

var _e;

function writeMenu(msg, result, bot) {

}

function addCategory(msg, result, bot) {
    // TODO
}

function removeItem(msg, result, bot) {
    if (msg.chat.id == admin_id)
        _e.libs['gpindex_common'].doRemoval(result[1])
        .then((ret) => {
            bot.sendMessage(msg.chat.id, 'Success');
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, 'Failed\n\n' + util.inspect(e));
        })
}

function markInvaild(msg, result, bot) {
    if (msg.chat.id == admin_id)
        _e.libs['gpindex_common'].getRecord(result[1])
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
        _e.libs['gpindex_common'].getRecord(result[1])
        .then((ret) => {
            if (ret) {
                if (ret.is_public) _e.libs['gpindex_common'].event.emit('new_public_commit', ret);
                else _e.libs['gpindex_common'].event.emit('new_private_commit', ret);
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
        bot.getChat(gname)
        .then((ret) => {
            ginfo = ret;
            return _e.libs['gpindex_common'].getRecord(ret.id)
        })
        .then((ret) => {
            if (ret) {
                throw {err: 'errorAlreadyExist'};
            } else {
                return bot.getChatAdministrators(ginfo.id)
            }
        }).then((ret) => {
            ret.forEach((child)=> {
                if (child.status == 'creator') ginfo.creator = child.user.id;
            });
            if (ginfo.creator) {
                ginfo.is_public = true;
                ginfo.tag = tag;
                ginfo.desc = desc;
                return _e.libs['gpindex_common'].silentInsert(ginfo);
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
	    _e.libs['gpindex_common'].getRecord(gid)
        .then((ret) => {
            if (ret) {
                return _e.libs['gpindex_common'].silentUpdate(gid, {tag: newtag})
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
        bot.getChat(parseInt(result[1]))
        .then((ret) => {
            bot.sendMessage(msg.chat.id, util.inspect(ret));
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, util.inspect(e));
        })
}

function doForceUpdate(msg, result, bot) {
    if (msg.chat.id == admin_id)
        bot.getChat(parseInt(result[1]))
        .then((ret) => {
            var updation = {
                title: ret.title
            }
            if (ret.username) updation.username = ret.username;
            return _e.libs['gpindex_common'].silentUpdate(ret.id, updation)
        })
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
    },
    run: [
        [/^\/publish ([0-9-]{6,})$/, doPublish],
        [/^\/addcategory (.*)$/, addCategory],
        [/^\/removeitem ([0-9-]{6,})$/, removeItem],
        [/^\/markinvaild ([0-9-]{6,})$/, markInvaild],
        [/^\/import_pub (@[_A-Za-z0-9]{4,}) ([^\n\s]+) ((?:.|\n)+)/m, doImportPublicGroup],
        [/^\/tagmove ([0-9-]{6,}) ([^\n\s]+)$/, doTagMove],
        [/^\/rmfeedid ([0-9]{1,})$/, doRemoveFeedByID],
        [/^\/rmfeedid https:\/\/(?:telegram.me|t.me)\/[_A-Za-z0-9]{4,}\/([0-9]{1,})$/, doRemoveFeedByID],
        [/^\/getchat ([0-9-]{6,})$/, getChat],
        [/^\/forceupdate ([0-9-]{6,})$/, doForceUpdate]
    ]
}
