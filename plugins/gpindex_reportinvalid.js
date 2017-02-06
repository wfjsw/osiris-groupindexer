'use strict';

const ADMIN_GROUP = require('../config.json')['gpindex_admin'];

var _e, comlib;

var util = require('util');

function processCallbackButton(msg, type, bot) {
    var operator = msg.data.split(':')[0];
    var gid = msg.data.split(':')[1];
    if (operator == 'reportinvalid') {
        comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
        .then((ret) => {
            if (!ret) 
                return _e.bot.sendMessage(ADMIN_GROUP, util.format('User @%s (%s) has reported an invalid group link.\nID: %s', msg.from.username, msg.from.id, gid))
            else throw 'UserBlocked'
        })
        .then((ret) => {
            _e.bot.answerCallbackQuery(msg.id, '感谢您的帮助，我们将尽快修复失效链接。', true);
        })
        .catch((e) => {
            if (e == 'UserBlocked') {
                _e.bot.answerCallbackQuery(msg.id, '对不起，您已被禁止使用此功能。', true);
            } else {
                _e.bot.sendMessage(ADMIN_GROUP, '```'+util.inspect(e)+'```', {
                    parse_mode: 'Markdown'
                })
                _e.bot.answerCallbackQuery(msg.id, '对不起，出现了一些问题，请稍后再试。', true);
            }
        })
    }
}

module.exports = {
    init: (e) => {
        _e = e
        comlib = e.libs['gpindex_common']
    },
    run: [
        ['callback_query', processCallbackButton]
    ]
}
