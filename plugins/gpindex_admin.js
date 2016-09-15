'use strict';

const admin_id = require('../config.json')['gpindex_admin'];
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
                return _e.libs['gpindex_common'].silentWrite(ginfo);
            } else throw {err: 'cannotConfirmCreator'}; 
        }).then((ret) => {
            bot.sendMessage(msg.chat.id, util.inspect(ret) + '\n\n' + util.inspect(ginfo));
        })
        .catch((e) => {
            bot.sendMessage(msg.chat.id, 'Failed\n\n' + util.inspect(e));
        });
    else bot.sendMessage(msg.chat.id, 'Failed to parse Input' + util.inspect(result));
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
        [/^\/import_pub (@[_A-Za-z0-9]{4,}) ([^\n\s]+) ((?:.|\n)+)/m, doImportPublicGroup]
    ]
}
