'use strict';

const util = require('util');
const langres = require('../resources/gpindex_publisher.json');

const channel_id = 0;

var _e;

function initevents() {
    var context = _e.libs['gpindex_common'].event,
    bot = _e.bot;
    context.on('new_public_commit', (groupinfo) => {
        // New Public Group
        var text = util.format(langres['newPublic'], groupinfo.title, groupinfo.username);
        bot.sendMessage(channel_id, text, {
            reply_markup: [[{text: langres['buttonJoin'], url: 'https://telegram.me/' + groupinfo.username}]]
        });
    });
    context.on('update_public_data', (groupinfo) => {
        // Public Group Updated
    });
    context.on('new_private_commit', (groupinfo) => {
        // New Public Group
        var text = util.format(langres['newPrivate'], groupinfo.title, groupinfo.invite_link);
        bot.sendMessage(channel_id, text, {
            reply_markup: [[{text: langres['buttonJoin'], url: groupinfo.invite_link}]]
        });
    });
    context.on('update_private_data', (groupinfo) => {
        // Private Group Updated
    });
}

module.exports = {
    init: (e) => {
        _e = e;
        initevents();
    }
}
