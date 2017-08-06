'use strict';

const util = require('util');
const he = require('he');
const tags = require('../config.gpindex.json')['gpindex_tags']
const langres = require('../resources/gpindex_listing.json');
const admin_id = require('../config.gpindex.json')['gpindex_admin'];

const single_inline_threshold = 10

var _e, comlib, _ga;

function errorProcess(msg, bot, err) {
    if (err == 'notValidated') return
    var errorlog = '```\n' + err.stack + '```\n';
    console.error(err);
    bot.sendMessage(admin_id, errorlog, {
        parse_mode: 'Markdown'
    });
}


/**
 * @param {Boolean} is_public 
 * @param {Number} id 
 * @param {String} title 
 * @param {String} tag 
 * @param {String} desc 
 * @param {String} target
 * @return {Object}
 */
function wrapJoinDialog(is_public, id, title, tag, desc, target) {
    if (is_public) {
        const message = util.format(langres['infoPubGroup'], id, title, target, tag, desc)
        const keyboard = {
            inline_keyboard: [
                [{
                    text: langres['buttonJoin'],
                    url: 'https://t.me/' + target
                }]
            ]
        }
        return {
            message,
            keyboard
        }
    } else {
        const message = util.format(langres['infoPrivGroup'], id, title, tag, desc)
        const keyboard = {
            inline_keyboard: [
                [{
                    text: langres['buttonJoin'],
                    url: target
                }]
            ]
        }
        return {
            message,
            keyboard
        }
    }
}

async function processInlineById(msg, bot) {
    try {
        const id = /^##([0-9-]{5,})$/.exec(msg.query)[1]
        const query_result = await comlib.getRecord(id)
        if (query_result) {
            const {
                message,
                keyboard
            } = wrapJoinDialog(query_result.is_public,
                query_result.id,
                query_result.title,
                query_result.tag,
                query_result.desc,
                query_result.is_public ? query_result.username : query_result.invite_link
            )
            const result = [{
                type: 'article',
                id: query_result.id.toString(),
                title: `${query_result.title} # ${query_result.tag}`,
                description: query_result.desc,
                reply_markup: keyboard,
                input_message_content: {
                    message_text: message,
                    disable_web_page_preview: true
                }
            }]
            return await bot.answerInlineQuery(msg.id, result, {
                next_offset: '',
                cache_time: 300, //on production env
            })
        }
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

async function processInlineByName(msg, bot) {
    try {
        const query = msg.query
        const offset = parseInt(msg.offset) || 0
        let result = await comlib.searchByName(query)
        const total_length = result.length
        /* if (total_length > 100) {
            _ga.tEvent(msg.from, 'inline', 'inline.tooManyItems')
            const result = [{
                type: 'article',
                id: '403',
                title: `对不起，无法输出搜索结果，请缩小搜索范围后重试。`,
                input_message_content: {
                    message_text: '对不起，无法输出搜索结果，请缩小搜索范围后重试。',
                    disable_web_page_preview: true
                }
            }]
            return await bot.answerInlineQuery(msg.id, result, {
                next_offset: '',
                cache_time: 300, //on production env
            })
        } */
        let result_array = []
        result = result.slice(offset, offset + single_inline_threshold)
        result.forEach(ret => {
            const {
                message,
                keyboard
            } = wrapJoinDialog(ret.is_public,
                ret.id,
                ret.title,
                ret.tag,
                ret.desc,
                ret.is_public ? ret.username : `https://t.me/${_e.me.username}?start=getdetail=${ret.id}`
            )
            result_array.push({
                type: 'article',
                id: ret.id.toString(),
                title: `${ret.title} # ${ret.tag}`,
                description: ret.desc,
                reply_markup: keyboard,
                input_message_content: {
                    message_text: message,
                    disable_web_page_preview: true
                }
            })
        })
        let next_offset
        if (total_length > (offset + single_inline_threshold))
            next_offset = offset + single_inline_threshold
        else
            next_offset = ''
        return await bot.answerInlineQuery(msg.id, result_array, {
            next_offset: next_offset.toString(),
            cache_time: 300, //on production env
        })
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

async function processInlineByCategory(msg, bot) {
    try {
        const query = /^#(.+)/.exec(msg.query)[1]
        const offset = parseInt(msg.offset) || 0
        let result = await comlib.getRecByTag(query)
        const total_length = result.length
        let result_array = []
        result = result.slice(offset, offset + single_inline_threshold)
        result.forEach(ret => {
            const {
                message,
                keyboard
            } = wrapJoinDialog(ret.is_public,
                ret.id,
                ret.title,
                ret.tag,
                ret.desc,
                ret.is_public ? ret.username : `https://t.me/${_e.me.username}?start=getdetail=${ret.id}`
            )
            result_array.push({
                type: 'article',
                id: ret.id.toString(),
                title: `${ret.title} # ${ret.tag}`,
                description: ret.desc,
                reply_markup: keyboard,
                input_message_content: {
                    message_text: message,
                    disable_web_page_preview: true
                }
            })
        })
        let next_offset
        if (total_length > (offset + single_inline_threshold))
            next_offset = offset + single_inline_threshold
        else
            next_offset = ''
        return await bot.answerInlineQuery(msg.id, result_array, {
            next_offset: next_offset.toString(),
            cache_time: 300, //on production env
        })
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

async function processInlineQuery(msg, type, bot) {
    try {
        const is_blocked = await comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
        const is_validated = await comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
        if (!is_blocked && is_validated) {
            if (msg.query != '') {
                if (/^##[0-9-]{5,}$/.test(msg.query)) {
                    _ga.tEvent(msg.from, 'inline', 'inline.queryById')
                    processInlineById(msg, bot)
                } else if (/^#.+/.test(msg.query)) {
                    _ga.tEvent(msg.from, 'inline', 'inline.queryByCategory')
                    processInlineByCategory(msg, bot)
                } else {
                    _ga.tEvent(msg.from, 'inline', 'inline.queryByName')
                    processInlineByName(msg, bot)
                }
            } else {
                return bot.answerInlineQuery(msg.id, [], {
                    next_offset: '',
                    cache_time: 300, //on production env
                })
            }
        } else {
            if (is_blocked)
                _ga.tEvent(msg.from, 'blocked', 'blocked.inline')
            const result = [{
                type: 'article',
                id: '403',
                title: `您没有通过身份认证或已被封禁，无法使用此功能。`,
                input_message_content: {
                    message_text: '请通过身份验证后再使用此功能。\n\nhttps://t.me/zh_groups_bot',
                    disable_web_page_preview: true
                }
            }]
            return await bot.answerInlineQuery(msg.id, result, {
                next_offset: '',
                cache_time: 300, //on production env
            })
        }
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    run: [
        ['inline_query', processInlineQuery]
    ]
}
