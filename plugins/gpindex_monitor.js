'use strict';

const util = require('util');
const langres = require('../resources/gpindex_publisher.json');

const admin_id = require('../config.json')['gpindex_admin'];

var _e, bot;

function initevents() {
    var context = _e.libs['gpindex_common'].event;
    context.on('new_public_commit', (groupinfo) => {
        // New Public Group
        bot.sendMessage(admin_id, util.inspect(groupinfo), {
            disable_web_page_preview: true
        }).catch((e) => {
            console.error(e);
            bot.sendMessage(admin_id, e);
        })
    });
    context.on('update_public_data', (groupinfo) => {
        _e.libs['gpindex_common'].getRecord(groupinfo.id)
        .then((ret) => {
            return bot.sendMessage(admin_id, util.inspect(ret), {
                disable_web_page_preview: true
            });
        })
        .catch((e) => {
            bot.sendMessage(admin_id, e);
            console.error(e);
        })
    });
    context.on('new_private_commit', (groupinfo) => {
        bot.sendMessage(admin, util.inspect(groupinfo), {
		disable_web_page_preview: true
        }).catch((e)=>{
            bot.sendMessage(admin_id, e);
            console.error(e);
        })
    });
    context.on('update_private_data', (groupinfo) => {
        // Private Group Updated
        _e.libs['gpindex_common'].getRecord(groupinfo.id)
        .then((ret) => {
            bot.sendMessage(channel_id, util.inspect(ret), {
		    disable_web_page_preview: true
            });
        })
        .catch((e) => {
            bot.sendMessage(admin_id, e);
            console.error(e);
        })
    });
}

module.exports = {
    init: (e) => {
        _e = e;
        bot = _e.bot;
        initevents();
    }
}
