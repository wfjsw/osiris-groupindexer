'use strict'

const publish_rate_limit = 3 * 24 * 3600

const util = require('util')
const b64url = require('base64-url')
const langres = require('../resources/gpindex_publisher.json')

const channel_id = require('../config.gpindex.json')['gpindex_channel']
const admin_id = require('../config.gpindex.json')['gpindex_admin']

let last_updated = {}
let last_published_id = {}

var _e

function initevents() {
    var context = _e.libs['gpindex_common'].event,
        bot = _e.bot
    context.on('new_public_commit', async(groupinfo) => {
        // New Public Group
        let type = 'send'
        if (!groupinfo.force) {
            let is_silent = !!(await _e.libs['gpindex_common'].GroupExTag.queryGroupExTag(groupinfo.id, 'silent'))
            if (is_silent) return
            if (last_updated[groupinfo.id] && ((Math.floor(Date.now() / 1000) - last_updated[groupinfo.id]) < publish_rate_limit)) type = 'edit'
        }
        var text
        var link = 'https://t.me/' + _e.me.username + '?start=DEC-' + b64url.encode('getdetail=' + groupinfo.id)
        if (groupinfo.type == 'channel') text = util.format(langres['newPublicChan'], groupinfo.title, groupinfo.username, groupinfo.tag, groupinfo.desc, groupinfo.id)
        else text = util.format(langres['newPublic'], groupinfo.title, groupinfo.username, groupinfo.tag, groupinfo.desc, groupinfo.id)
        let reply_markup = {
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
        try {
            if (type == 'edit') {
                try {
                    return await bot.editMessageText({
                        chat_id: channel_id,
                        message_id: last_published_id[groupinfo.id],
                        text,
                        disable_web_page_preview: true,
                        reply_markup
                    })
                } catch (e) {
                    let result = await bot.sendMessage(channel_id, text, {
                        disable_web_page_preview: true,
                        reply_markup
                    })
                    last_updated[groupinfo.id] = Math.floor(Date.now() / 1000)
                    last_published_id[groupinfo.id] = result.message_id
                    return
                }
            } else if (type == 'send') {
                let result = await bot.sendMessage(channel_id, text, {
                    disable_web_page_preview: true,
                    reply_markup
                })
                last_updated[groupinfo.id] = Math.floor(Date.now() / 1000)
                last_published_id[groupinfo.id] = result.message_id
                return
            }
        } catch (e) {
            console.error(e)
            bot.sendMessage(admin_id, e.message)
        }
    })
    context.on('update_public_data', async(groupinfo) => {
        let type = 'send'
        if (!groupinfo.force) {
            let is_silent = !!(await _e.libs['gpindex_common'].GroupExTag.queryGroupExTag(groupinfo.id, 'silent'))
            if (is_silent) return
            if (last_updated[groupinfo.id] && ((Math.floor(Date.now() / 1000) - last_updated[groupinfo.id]) < publish_rate_limit)) type = 'edit'
        }
        try {
            let record = await _e.libs['gpindex_common'].getRecord(groupinfo.id)
            let text
            let link = 'https://t.me/' + _e.me.username + '?start=DEC-' + b64url.encode('getdetail=' + record.id)
            if (groupinfo.type == 'channel') text = util.format(langres['updatePublicChan'], record.title, record.username, record.tag, record.desc, record.id)
            else text = util.format(langres['updatePublic'], record.title, record.username, record.tag, record.desc, record.id)
            let reply_markup = {
                inline_keyboard: [
                    [{
                        text: langres['buttonJoin'],
                        url: 'https://t.me/' + record.username
                    }, {
                        text: langres['buttonDetail'],
                        url: link
                    }],
                    [{
                        text: langres['buttonShare'],
                        switch_inline_query: `##${record.id}`
                    }]
                ]
            }
            if (type == 'edit') {
                try {
                    return await bot.editMessageText({
                        chat_id: channel_id,
                        message_id: last_published_id[groupinfo.id],
                        text,
                        disable_web_page_preview: true,
                        reply_markup
                    })
                } catch (e) {
                    let result = await bot.sendMessage(channel_id, text, {
                        disable_web_page_preview: true,
                        reply_markup
                    })
                    last_updated[groupinfo.id] = Math.floor(Date.now() / 1000)
                    last_published_id[groupinfo.id] = result.message_id
                    return
                }
            } else if (type == 'send') {
                let result = await bot.sendMessage(channel_id, text, {
                    disable_web_page_preview: true,
                    reply_markup
                })
                last_published_id[groupinfo.id] = result.message_id
                last_updated[groupinfo.id] = Math.floor(Date.now() / 1000)
            }
        } catch (e) {
            bot.sendMessage(admin_id, e.message)
            console.error(e)
        }
    })
    context.on('new_private_commit', async(groupinfo) => {
        let type = 'send'
        if (!groupinfo.force) {
            let is_silent = !!(await _e.libs['gpindex_common'].GroupExTag.queryGroupExTag(groupinfo.id, 'silent'))
            if (is_silent) return
            if (last_updated[groupinfo.id] && ((Math.floor(Date.now() / 1000) - last_updated[groupinfo.id]) < publish_rate_limit)) type = 'edit'
        }
        // New Public Group
        let text
        var link = 'https://t.me/' + _e.me.username + '?start=DEC-' + b64url.encode('getdetail=' + groupinfo.id)
        // remove link in desc [security reason]
        groupinfo.desc = groupinfo.desc.replace(groupinfo.invite_link, '[隐藏]')
        if (groupinfo.type == 'channel') text = util.format(langres['newPrivateChan'], groupinfo.title, groupinfo.tag, groupinfo.desc, groupinfo.id)
        else text = util.format(langres['newPrivate'], groupinfo.title, groupinfo.tag, groupinfo.desc, groupinfo.id)
        let reply_markup = {
            inline_keyboard: [
                [{
                        text: langres['buttonDetail'],
                        url: link
                    },
                    {
                        text: langres['buttonShare'],
                        switch_inline_query: `##${groupinfo.id}`
                    }
                ]
            ]
        }
        try {
            if (type == 'edit') {
                try {
                    return await bot.editMessageText({
                        chat_id: channel_id,
                        message_id: last_published_id[groupinfo.id],
                        text,
                        disable_web_page_preview: true,
                        reply_markup
                    })
                } catch (e) {
                    let result = await bot.sendMessage(channel_id, text, {
                        disable_web_page_preview: true,
                        reply_markup
                    })
                    last_updated[groupinfo.id] = Math.floor(Date.now() / 1000)
                    last_published_id[groupinfo.id] = result.message_id
                    return
                }
            } else if (type == 'send') {
                let result = await bot.sendMessage(channel_id, text, {
                    disable_web_page_preview: true,
                    reply_markup
                })
                last_updated[groupinfo.id] = Math.floor(Date.now() / 1000)
                last_published_id[groupinfo.id] = result.message_id
            }
        } catch (e) {
            bot.sendMessage(admin_id, e.message)
            console.error(e)
        }
    })
    context.on('update_private_data', async(groupinfo) => {
        let type = 'send'
        if (!groupinfo.force) {
            let is_silent = !!(await _e.libs['gpindex_common'].GroupExTag.queryGroupExTag(groupinfo.id, 'silent'))
            if (is_silent) return
            if (last_updated[groupinfo.id] && ((Math.floor(Date.now() / 1000) - last_updated[groupinfo.id]) < publish_rate_limit)) type = 'edit'
        }
        // Private Group Updated
        try {
            let record = await _e.libs['gpindex_common'].getRecord(groupinfo.id)
            last_updated[groupinfo.id] = Math.floor(Date.now() / 1000)
            let text
            var link = 'https://t.me/' + _e.me.username + '?start=DEC-' + b64url.encode('getdetail=' + groupinfo.id)
            // remove link in desc [security reason]
            record.desc = record.desc.replace(record.invite_link, '[隐藏]')
            if (groupinfo.type == 'channel') text = util.format(langres['updatePrivateChan'], record.title, record.tag, record.desc, record.id)
            else text = util.format(langres['updatePrivate'], record.title, record.tag, record.desc, record.id)
            let reply_markup = {
                inline_keyboard: [
                    [{
                            text: langres['buttonDetail'],
                            url: link
                        },
                        {
                            text: langres['buttonShare'],
                            switch_inline_query: `##${groupinfo.id}`
                        }
                    ]
                ]
            }
            if (type == 'edit') {
                try {
                    return await bot.editMessageText({
                        chat_id: channel_id,
                        message_id: last_published_id[groupinfo.id],
                        text,
                        disable_web_page_preview: true,
                        reply_markup
                    })
                } catch (e) {
                    let result = await bot.sendMessage(channel_id, text, {
                        disable_web_page_preview: true,
                        reply_markup
                    })
                    last_updated[groupinfo.id] = Math.floor(Date.now() / 1000)
                    last_published_id[groupinfo.id] = result.message_id
                    return
                }
            } else if (type == 'send') {
                let result = await bot.sendMessage(channel_id, text, {
                    disable_web_page_preview: true,
                    reply_markup
                })
                last_updated[groupinfo.id] = Math.floor(Date.now() / 1000)
                last_published_id[groupinfo.id] = result.message_id
            }
        } catch (e) {
            bot.sendMessage(admin_id, e.message)
            console.error(e)
        }
    })
}

module.exports = {
    init: (e) => {
        _e = e
        initevents()
    }
}
