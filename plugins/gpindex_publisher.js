'use strict';

const util = require('util');
const langres = require('../resources/gpindex_publisher.json');

const channel_id = require('../config.gpindex.json')['gpindex_channel'];
const admin_id = require('../config.gpindex.json')['gpindex_admin'];

var _e;

function initevents() {
    var context = _e.libs['gpindex_common'].event,
        bot = _e.bot;
    context.on('new_public_commit', (groupinfo) => {
        // New Public Group
        var text;
        var link = 'https://t.me/' + _e.me.username + '?start=getdetail=' + groupinfo.id;
        if (groupinfo.type == 'channel') text = util.format(langres['newPublicChan'], groupinfo.title, groupinfo.username, groupinfo.tag, groupinfo.desc, groupinfo.id);
        else text = util.format(langres['newPublic'], groupinfo.title, groupinfo.username, groupinfo.tag, groupinfo.desc, groupinfo.id);
        bot.sendMessage(channel_id, text, {
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: langres['buttonJoin'],
                        url: 'https://t.me/' + groupinfo.username
                    }, {
                        text: langres['buttonDetail'],
                        url: link
                    }],
                    [{
                        text: langres['buttonShare'],
                        switch_inline_query: `##${groupinfo.id}`
                    }]
                ]
            }
        }).catch((e) => {
            console.error(e);
            bot.sendMessage(admin_id, e.stack);
        })
    });
    context.on('update_public_data', (groupinfo) => {
        _e.libs['gpindex_common'].getRecord(groupinfo.id)
            .then((ret) => {
                var text;
                var link = 'https://t.me/' + _e.me.username + '?start=getdetail=' + ret.id;
                if (groupinfo.type == 'channel') text = util.format(langres['updatePublicChan'], ret.title, ret.username, ret.tag, ret.desc, ret.id)
                else text = util.format(langres['updatePublic'], ret.title, ret.username, ret.tag, ret.desc, ret.id);
                return bot.sendMessage(channel_id, text, {
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: langres['buttonJoin'],
                                url: 'https://t.me/' + ret.username
                            }, {
                                text: langres['buttonDetail'],
                                url: link
                            }],
                            [{
                                text: langres['buttonShare'],
                                switch_inline_query: `##${ret.id}`
                            }]
                        ]
                    }
                });
            })
            .catch((e) => {
                bot.sendMessage(admin_id, e.stack);
                console.error(e);
            })
    });
    context.on('new_private_commit', (groupinfo) => {
        // New Public Group
        var link = 'https://t.me/' + _e.me.username + '?start=getdetail=' + groupinfo.id;
        var text = util.format(langres['newPrivate'], groupinfo.title, groupinfo.tag, groupinfo.desc, groupinfo.id);
        bot.sendMessage(channel_id, text, {
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: langres['buttonDetail'],
                        url: link
                    },
                    {
                        text: langres['buttonShare'],
                        switch_inline_query: `##${groupinfo.id}`
                    }]
                ]
            }
        }).catch((e) => {
            bot.sendMessage(admin_id, e.stack);
            console.error(e);
        })
    });
    context.on('update_private_data', (groupinfo) => {
        // Private Group Updated
        _e.libs['gpindex_common'].getRecord(groupinfo.id)
            .then((ret) => {
                var link = 'https://t.me/' + _e.me.username + '?start=getdetail=' + groupinfo.id;
                var text = util.format(langres['updatePrivate'], ret.title, ret.tag, ret.desc, ret.id);
                bot.sendMessage(channel_id, text, {
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: langres['buttonDetail'],
                                url: link
                            }, {
                                text: langres['buttonShare'],
                                switch_inline_query: `##${ret.id}`
                            }]
                        ]
                    }
                });
            })
            .catch((e) => {
                bot.sendMessage(admin_id, e.stack);
                console.error(e);
            })
    });
}

module.exports = {
    init: (e) => {
        _e = e;
        initevents();
    }
}
