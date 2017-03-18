'use strict';

const ADMIN_GROUP = require('../config.json')['gpindex_admin'];

var _e, comlib;

var util = require('util');

function processCallbackButton(msg, type, bot) {
    var operator = msg.data.split(':')[0];
    var gid = msg.data.split(':')[1];
    var ginfo
    if (operator == 'reportinvalid') {
        comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
        .then((ret) => {
            if (!ret) 
                return comlib.getRecord(parseInt(gid))
            else throw 'UserBlocked'
        })
        .then((ret) => {
            if (ret) {
                if (ret.extag && ret.extag['noreport'])
                    throw 'ReportNotAllowed'
                else
                    return _e.bot.sendMessage(ADMIN_GROUP, util.format('User @%s (%s) (%s %s) has reported an invalid group link.\nData: %s', msg.from.username, msg.from.id, msg.from.first_name, msg.from.last_name, util.inspect(ret)))
            } else 
                throw 'GroupNotFound'
        })
        .then((ret) => {
            _e.bot.answerCallbackQuery(msg.id, '感谢您的帮助，我们将尽快修复失效链接。', true);
        })
        .catch((e) => {
            switch (e) {
                case 'UserBlocked':
                    _e.bot.answerCallbackQuery(msg.id, '对不起，您已被禁止使用此功能。', true);
                    break;
                case 'GroupNotFound':
                    _e.bot.answerCallbackQuery(msg.id, '对不起，未找到您所报告的群组，该群组可能已从索引列表中被移除。', true);
                    break;
                case 'ReportNotAllowed':
                    _e.bot.answerCallbackQuery(msg.id, '对不起，该群组已被标记为不可报告。', true);
                    break;
                default: 
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
