'use strict';

const util = require('util');
const langres = require('../resources/gpindex_publisher.json');

//const channel_id = '@zh_groups';
const channel_id = require('../config.json')['gpindex_channel'];

var _e;

function initevents() {
    var context = _e.libs['gpindex_common'].event,
    bot = _e.bot;
    context.on('new_public_commit', (groupinfo) => {
        // New Public Group
        var text = util.format(langres['newPublic'], groupinfo.title, groupinfo.username, groupinfo.tag, groupinfo.desc, groupinfo.id);
        bot.sendMessage(channel_id, text, {
		reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: 'https://telegram.me/' + groupinfo.username}]]}
        });
    });
    context.on('update_public_data', (groupinfo) => {
        _e.libs['gpindex_common'].getRecord(groupinfo.id)
        .then((ret) => {
            var text = util.format(langres['updatePublic'], ret.title, ret.username, ret.tag, ret.desc, ret.id);
            return bot.sendMessage(channel_id, text, {
                reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: 'https://telegram.me/' + ret.username}]]}
            });
        })
        .catch((e) => {
            console.error(e);
        })
    });
    context.on('new_private_commit', (groupinfo) => {
        // New Public Group
        var text = util.format(langres['newPrivate'], groupinfo.title, groupinfo.invite_link, groupinfo.tag, groupinfo.desc, groupinfo.id);
        bot.sendMessage(channel_id, text, {
		reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: groupinfo.invite_link}]]}
        });
    });
    context.on('update_private_data', (groupinfo) => {
        // Private Group Updated
        _e.libs['gpindex_common'].getRecord(groupinfo.id)
        .then((ret) => {
            var text = util.format(langres['updatePrivate'], ret.title, ret.invite_link, ret.tag, ret.desc, ret.id);
            bot.sendMessage(channel_id, text, {
                reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: ret.invite_link}]]}
            });
        })
        .catch((e) => {

        })
    });
}

module.exports = {
    init: (e) => {
        _e = e;
        initevents();
    }
}
