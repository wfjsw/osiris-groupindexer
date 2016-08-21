'use strict';

const channel_id = 0;

var _e;

function initevents() {
    var context = _e.libs['gpindex_common'].event,
    bot = _e.bot;
    context.on('new_public_commit', (groupinfo) => {
        // New Public Group
        // bot.sendMessage(channel_id, '');
    });
    context.on('update_public_data', (groupinfo) => {
        // Public Group Updated
    });
    context.on('new_private_commit', (groupinfo) => {
        // New Private Group
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
