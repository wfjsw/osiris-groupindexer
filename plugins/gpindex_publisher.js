'use strict';

const util = require('util');
const langres = require('../resources/gpindex_publisher.json');

const channel_id = '@zh_groups';

var _e;

function initevents() {
    var context = _e.libs['gpindex_common'].event,
    bot = _e.bot;
    context.on('new_public_commit', (groupinfo) => {
        // New Public Group
        var text = util.format(langres['newPublic'], groupinfo.title, groupinfo.username, groupinfo.id, groupinfo.tag, groupinfo.desc);
        bot.sendMessage(channel_id, text, {
		reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: 'https://telegram.me/' + groupinfo.username}]]}
        });
    });
    context.on('update_public_data', (groupinfo) => {
        var text = util.format(langres['updatePublic'], groupinfo.title, groupinfo.username, groupinfo.id);
        bot.sendMessage(channel_id, text, {
		reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: 'https://telegram.me/' + groupinfo.username}]]}
        });
    });
    context.on('new_private_commit', (groupinfo) => {
        // New Public Group
        var text = util.format(langres['newPrivate'], groupinfo.title, groupinfo.invite_link, groupinfo.id, groupinfo.tag, groupinfo.desc);
        bot.sendMessage(channel_id, text, {
		reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: groupinfo.invite_link}]]}
        });
    });
    context.on('update_private_data', (groupinfo) => {
        // Private Group Updated
        var text = util.format(langres['updatePrivate'], groupinfo.title, groupinfo.invite_link, grouplink.id);
        bot.sendMessage(channel_id, text, {
		reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: groupinfo.invite_link}]]}
        });
    });
}

module.exports = {
    init: (e) => {
        _e = e;
        initevents();
    }
}
