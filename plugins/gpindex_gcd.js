'use strict';

const { gcd } = require('../config.gpindex.json')
var _ga, _bot
var current_timer = 0, 
    cache_link = '', 
    cache_time = 0

function updateLink() {
    // _ga.tEvent(msg.from, 'intro', 'gcd.newLinkGenerated')
    return _bot.exportChatInviteLink(gcd)
        .then(link => {
            cache_time = new Date().valueOf()
            cache_link = link
            return link
        })
}

function sendGCDLink(msg, result, bot) {
    if (msg.chat.id > 0) {
        _ga.tEvent(msg.from, 'intro', 'gcd.requestGCDLink')
        comlib.getRecByCreator(msg.from.id)
            .then(recs => {
                if ((recs||[]).length > 0) {
                    if ((new Date().valueOf() - cache_time) > 3*60*1000) {
                        sendLink(msg, cache_link, bot)
                        setTimeout(updateLink, 3*60*1000)
                    } else {
                        sendLink(msg, cache_link, bot)
                    }
                }
            }).catch(e => {
                _ga.tException(msg.from.id, e.description, false)
            })
    }
}

function sendLink(msg, link, bot) {
    return bot.sendMessage(msg.from.id, '欢迎加入 “群主信息交流小组”，链接有效期为三分钟，请勿传播。', {
        reply_to_message_id: msg.message_id,
        reply_markup: {inline_keyboard:[[{text: '加入', url: link}]]}
    })
}

function printCreatedChat(msg, type, bot) {
    if (msg.chat.id == gcd) {
        comlib.getRecByCreator(msg.from.id)
        .then(recs => {
            if ((recs||[]).length > 0) {
                let out = ''
                recs.forEach((rec) => {
                    let line;
                    line = rec.id
                    line += ' - '
                    line += rec.title + ` (#${rec.tag})\n`
                    out += line
                })
                bot.sendMessage(msg.chat.id, out, {
                    reply_to_message_id: msg.message_id
                })
            } else {
                bot.sendMessage(msg.chat.id, '该用户没有登记任何群。', {
                    reply_to_message_id: msg.message_id
                })
            }
        }).catch(e => {
            _ga.tException(msg.from.id, e.description, false)
        })
    }
}

module.exports = {
    init: (e) => {
        _ga = e.libs['ga']
        _bot = e.bot
        updateLink()
    },
    run: [
        [/^\/joingcd$/, sendGCDLink],
        [/^\/start joingcd$/, sendGCDLink],
        ['new_chat_member', printCreatedChat]
    ]
}
