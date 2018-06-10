'use strict';

const util = require('util');
const he = require('he');
const b64url = require('base64-url')
const {
    URL
} = require('url')
const tags = require('../config.gpindex.json')['gpindex_tags']
const langres = require('../resources/gpindex_listing.json');
const {
    gpindex_admin,
    groupsicon_prefix
} = require('../config.gpindex.json')

const single_inline_threshold = 10

var _e, comlib, _ga;

function errorProcess(msg, bot, err) {
    if (err == 'notValidated') return
    var errorlog = 'inline: \n```\n' + err.message + '```\n';
    _ga.tException(msg.from, err, true)
    console.error(err);
    bot.sendMessage(gpindex_admin, errorlog, {
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
function wrapJoinDialog(is_public, id, title, tag, desc, target, is_official) {
    let officialstate = ''
    if (is_official) {
        switch (parseInt(is_official)) {
            case 1:
                officialstate = '\n✅已通过官方身份验证'
                break
            case 2:
                officialstate = '\n❌未通过官方身份验证'
                break
        }
    }
    if (is_public) {
        const message = util.format(langres['infoPubGroup'], id, title, target, tag + officialstate, desc)
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
        const message = util.format(langres['infoPrivGroup'], id, title, tag + officialstate, desc)
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
                query_result.is_public ? query_result.username : `https://t.me/${_e.me.username}?start=DEC-${b64url.encode(`getdetail=${query_result.id}`)}`,
                query_result.extag['official']
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
            if (query_result.photo)
                if (query_result.photo.small_file_id)
                    result[0].thumb_url = new URL(query_result.photo.small_file_id, groupsicon_prefix)
            return await bot.answerInlineQuery(msg.id, result, {
                next_offset: '',
                cache_time: 300, //on production env
            })
        }
    } catch (e) {
        errorProcess(msg, bot, e)
        const result = [{
            type: 'article',
            id: '400',
            title: `在按您的请求搜索时出现错误。`,
            input_message_content: {
                message_text: '在按您的请求搜索时出现错误。\n\n技术详情：' + e.message,
                disable_web_page_preview: true
            }
        }]
        return await bot.answerInlineQuery(msg.id, result, {
            next_offset: '',
            cache_time: 5, //on production env
        })
    }
}

async function processInlineByName(msg, bot) {
    try {
        const query = msg.query
        const offset = parseInt(msg.offset) || 0
        let result = await comlib.searchByName(query, offset, single_inline_threshold, 'count_desc')
        if (!result) {
            if (msg.offset) {
                return await bot.answerInlineQuery(msg.id, [], {
                    next_offset: '',
                    cache_time: 300, //on production env
                })
            } else {
                const result = [{
                    type: 'article',
                    id: '403',
                    title: `什么都没有找到 _(:з」∠)_`,
                    input_message_content: {
                        message_text: '什么都没有找到 _(:з」∠)_',
                        disable_web_page_preview: true
                    }
                }]
                return await bot.answerInlineQuery(msg.id, result, {
                    next_offset: '',
                    cache_time: 300, //on production env
                })
            }
        }
        result = result.filter(record => tags.indexOf(record.tag) > -1)
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
        /*result = result.sort((a, b) => {
            const ca = a.member_count || 0
            const cb = b.member_count || 0
            if (ca > cb) {
                return -1
            } else if (ca == cb) {
                return 0
            } else if (ca < cb) {
                return 1
            }
        })*/
        //result = result.slice(offset, offset + single_inline_threshold)
        result.forEach(ret => {
            const {
                message,
                keyboard
            } = wrapJoinDialog(ret.is_public,
                ret.id,
                ret.title,
                ret.tag,
                ret.desc,
                ret.is_public ? ret.username : `https://t.me/${_e.me.username}?start=DEC-${b64url.encode(`getdetail=${ret.id}`)}`,
                ret.extag['official']
            )
            let item = {
                type: 'article',
                id: ret.id.toString(),
                title: `${ret.title} # ${ret.tag}`,
                description: ret.desc,
                reply_markup: keyboard,
                input_message_content: {
                    message_text: message,
                    disable_web_page_preview: true
                }
            }
            if (ret.photo)
                if (ret.photo.small_file_id)
                    item.thumb_url = new URL(ret.photo.small_file_id, groupsicon_prefix)
            result_array.push(item)
        })
        let next_offset
        //if (total_length > (offset + single_inline_threshold))
        //if (total_length >= single_inline_threshold)
            next_offset = offset + single_inline_threshold
        //else
        //    next_offset = ''
        return await bot.answerInlineQuery(msg.id, result_array, {
            next_offset: next_offset.toString(),
            cache_time: 300, //on production env
        })
    } catch (e) {
        errorProcess(msg, bot, e)
        const result = [{
            type: 'article',
            id: '400',
            title: `在按您的请求搜索时出现错误。`,
            input_message_content: {
                message_text: '在按您的请求搜索时出现错误。\n\n技术详情：' + e.message,
                disable_web_page_preview: true
            }
        }]
        return await bot.answerInlineQuery(msg.id, result, {
            next_offset: '',
            cache_time: 5, //on production env
        })
    }
}

async function processInlineByCategory(msg, bot) {
    try {
        const query = /^#(.+)/.exec(msg.query)[1]
        const offset = parseInt(msg.offset) || 0
        if (tags.indexOf(query) > -1) {
            let result = await comlib.getRecByTag(query, offset, single_inline_threshold, 'count_desc')
            if (!result) {
                if (msg.offset) {
                    return await bot.answerInlineQuery(msg.id, [], {
                        next_offset: '',
                        cache_time: 300, //on production env
                    })
                } else {
                    const result = [{
                        type: 'article',
                        id: '403',
                        title: `什么都没有找到 _(:з」∠)_`,
                        input_message_content: {
                            message_text: '什么都没有找到 _(:з」∠)_',
                            disable_web_page_preview: true
                        }
                    }]
                    return await bot.answerInlineQuery(msg.id, result, {
                        next_offset: '',
                        cache_time: 300, //on production env
                    })
                }
            }
            const total_length = result.length
            let result_array = []
            /*result = result.sort((a, b) => {
                const ca = a.member_count || 0
                const cb = b.member_count || 0
                if (ca > cb) {
                    return -1
                } else if (ca == cb) {
                    return 0
                } else if (ca < cb) {
                    return 1
                }
            })*/
            //result = result.slice(offset, offset + single_inline_threshold)
            result.forEach(ret => {
                const {
                    message,
                    keyboard
                } = wrapJoinDialog(ret.is_public,
                    ret.id,
                    ret.title,
                    ret.tag,
                    ret.desc,
                    ret.is_public ? ret.username : `https://t.me/${_e.me.username}?start=DEC-${b64url.encode(`getdetail=${ret.id}`)}`,
                    ret.extag['official']
                )
                let item = {
                    type: 'article',
                    id: ret.id.toString(),
                    title: `${ret.title} # ${ret.tag}`,
                    description: ret.desc,
                    reply_markup: keyboard,
                    input_message_content: {
                        message_text: message,
                        disable_web_page_preview: true
                    }
                }
                if (ret.photo)
                    if (ret.photo.small_file_id)
                        item.thumb_url = new URL(ret.photo.small_file_id, groupsicon_prefix)
                result_array.push(item)
            })
            let next_offset
            //if (total_length > (offset + single_inline_threshold))
            //if (total_length >= single_inline_threshold)
                next_offset = offset + single_inline_threshold
            //else
            //    next_offset = ''
            return await bot.answerInlineQuery(msg.id, result_array, {
                next_offset: next_offset.toString(),
                cache_time: 300, //on production env
            })
        } else {
            return await bot.answerInlineQuery(msg.id, [], {
                next_offset: '',
                cache_time: 300, //on production env
            })
        }
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

async function processInlineQuery(msg, type, bot) {
    try {
        const [is_validated, is_blocked, is_halal, is_nothalal] = await comlib.UserFlag.queryUserFlag(msg.from.id, ['validated', 'block', 'halal', 'nothalal'])
        const is_in_jvbao = _e.libs['nojvbao_lib'] ? (await _e.libs['nojvbao_lib'].checkUser(msg.from.id)) : false
        if (!is_blocked && !(_e.plugins['gpindex_validateuser'] && !is_validated) && !is_in_jvbao && (!is_halal || is_nothalal)) {
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
                title: `您没有通过身份认证或已被封禁， 无法使用此功能。 `,
                input_message_content: {
                    message_text: '请通过身份验证后再使用此功能，验证后请等待 10 秒钟生效。\n\nhttps://t.me/zh_groups_bot',
                    disable_web_page_preview: true
                }
            }]
            return await bot.answerInlineQuery(msg.id, result, {
                next_offset: '',
                cache_time: 10, //on production env
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
