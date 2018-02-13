'use strict';

const ADMIN_GROUP = require('../config.gpindex.json')['gpindex_admin'];

var _e, comlib, _ga;

var util = require('util');

async function tryFixPublic(msg, bot, record) {
    try {
        const current = await bot.getChat(record.id)
        if (!current.username)
            return false
        if (current.username != record.username || current.title != record.title) {
            let updation = {
                title: current.title,
                username: current.username
            }
            let db_ret = await comlib.silentUpdate(record.id, updation)
            await _e.bot.sendMessage(ADMIN_GROUP, 'FixPublic\n\n' + util.inspect(db_ret))
            return true
        }
        return true
    } catch (e) {
        console.error(e.stack)
        return false
    }
}

async function processCallbackButton(msg, type, bot) {
    var [operator, gid] = msg.data.split(':')
    if (operator == 'reportinvalid') {
        try {
            const is_blocked = await comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
            if (is_blocked) {
                _ga.tEvent(msg.from, 'blocked', 'blockedUserAttempt.reportInvalid')
                return await bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: '对不起，您已被禁止使用此功能。',
                    show_alert: true,
                    cache_time: 60
                });
            }
            const record = await comlib.getRecord(parseInt(gid))
            if (!record) {
                _ga.tEvent(msg.from, 'reportinvalid', 'reportinvalid.groupNotFound')
                return await bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: '对不起，未找到您所报告的群组，该群组可能已从索引列表中被移除。',
                    show_alert: true,
                    cache_time: 60
                });
            }
            const is_superadmin = !(['left', 'kicked'].indexOf((await bot.getChatMember(ADMIN_GROUP, msg.from.id)).status) > -1)
            if (is_superadmin) {
                await bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: ''
                });
                return await bot.sendMessage(ADMIN_GROUP, util.inspect(record))
            }
            if (record.extag && record.extag['noreport']) {
                _ga.tEvent(msg.from, 'reportinvalid', 'reportinvalid.notAllowed')
                return await bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: '对不起，该群组已被标记为不可报告。',
                    show_alert: true,
                    cache_time: 60
                });
            }
            if (record.is_public) {
                let is_success = await tryFixPublic(msg, bot, record)
                if (is_success) {
                    _ga.tEvent(msg.from, 'reportinvalid', 'reportinvalid.autoFix')
                    return await bot.answerCallbackQuery({
                        callback_query_id: msg.id,
                        text: '群组信息已自动刷新，请重试。',
                        show_alert: true,
                        cache_time: 60
                    });
                }
            }
            let is_kicked = false
            try {
                is_kicked = (await bot.getChatMember(record.id, msg.from.id)).status == 'kicked'
            } catch (e) {
                is_kicked = false
            }
            if (is_kicked) {
                _ga.tEvent(msg.from, 'reportinvalid', 'reportinvalid.kickedReport')
                return await bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: '您被该群的群主或管理员移出群组。请询问该群管理员以获得更多详情。',
                    show_alert: true,
                    cache_time: 60
                });
            }
            _ga.tEvent(msg.from, 'reportinvalid', 'reportinvalid.doReport')
            await bot.sendMessage(ADMIN_GROUP, util.format('User @%s (%s) (%s %s) has reported an invalid group link.\nData: %s', msg.from.username, msg.from.id, msg.from.first_name, msg.from.last_name, util.inspect(record)))
            return await _e.bot.answerCallbackQuery({
                callback_query_id: msg.id,
                text: '感谢您的帮助，我们将尽快修复失效链接。',
                show_alert: true,
                cache_time: 60
            });
        } catch (e) {
            _ga.tException(msg.from.id, e, false)
            await _e.bot.sendMessage(ADMIN_GROUP, '```' + util.inspect(e.stack) + '```', {
                parse_mode: 'Markdown'
            })
            return _e.bot.answerCallbackQuery({
                callback_query_id: msg.id,
                text: '对不起，出现了一些问题，请稍后再试。',
                show_alert: true
            });
        }
    }
}

module.exports = {
    init: (e) => {
        _e = e
        comlib = e.libs['gpindex_common']
        _ga = e.libs['ga']
    },
    run: [
        ['callback_query', processCallbackButton]
    ]
}
