'use strict';

const util = require('util');
const he = require('he').encode
const b64url = require('base64-url')
const tags = require('../config.gpindex.json')['gpindex_tags']
const langres = require('../resources/gpindex_listing.json');
const admin_id = require('../config.gpindex.json')['gpindex_admin'];
const {stickerHalal} = require('../resources/gpindex_antihalal.json')

var dynlink_cache = {}

var _e, comlib, _ga;

function purgeState(msg, result, bot) {
    comlib.unsetLock(msg.from.id);
    bot.sendMessage(msg.chat.id, langres['infoSessionCleared'], {
        reply_markup: {
            hide_keyboard: true
        }
    });
}

function errorProcess(msg, bot, err) {
    if (err == 'notValidated') return
    var errorlog = '```\n' + err.stack + '```\n';
    console.error(err);
    try {
        bot.sendMessage(msg.chat.id, langres['infoBugReport'], {
            reply_to_message_id: msg.message_id
        })
    } catch (e) {}
    _ga.tException(msg.from, err, true)
    bot.sendMessage(admin_id, errorlog, {
        parse_mode: 'Markdown'
    });
    purgeState(msg, 'errrpt', bot);
}

async function generateDynLink(gid, bot) {
    try {
        const new_link = await bot.exportChatInviteLink(gid)
        dynlink_cache[gid] = {
            time: Date.now(),
            link: new_link,
            displayed: false
        }
        return new_link
    } catch (e) {
        console.error(e)
        var errorlog = gid + '\n```\n' + e.message + '```\n';
        await bot.sendMessage(admin_id, errorlog, {
            parse_mode: 'Markdown'
        });
        return false
    }
}

async function getDynLink(gid, bot) {
    if (dynlink_cache[gid]) {
        if (!dynlink_cache[gid].displayed) {
            // generated in 5 min window, not displayed yet, display now
            dynlink_cache[gid].displayed = true
            dynlink_cache[gid].time = Date.now()
            setTimeout(generateDynLink, 5 * 60 * 1000, gid, bot)
            return dynlink_cache[gid].link
        } else if ((Date.now() - dynlink_cache[gid].time) < 5.5 * 60 * 1000) {
            // in valid cache time
            return dynlink_cache[gid].link
        } else {
            // is exception, 5 min window regeneration not working, manually regenerate.
            const link = await generateDynLink(gid, bot)
            if (!link) return false
            dynlink_cache[gid].displayed = true
            setTimeout(generateDynLink, 5 * 60 * 1000, gid, bot)
            return link
        }
    } else {
        // not yet cached, create
        try {
            let { invite_link } = await bot.getChat(gid)
            let link
            if (invite_link) {
                link = invite_link // reuse old link
                dynlink_cache[gid] = {
                    time: Date.now(),
                    link: invite_link
                }
            } else {
                link = await generateDynLink(gid, bot)
            }
            if (!link) return false
            dynlink_cache[gid].displayed = true
            setTimeout(generateDynLink, 5 * 60 * 1000, gid, bot)
            return link
        } catch (e) {
            console.error(e)
            var errorlog = gid + '\n```\n' + e.message + '```\n';
            await bot.sendMessage(admin_id, errorlog, {
                parse_mode: 'Markdown'
            });
            return false
        }
    }
}

function generateList(recs) {
    let outmsg = []
    outmsg[0] = ''
    var head = 0
    /*let sorted_recs = recs.sort((a, b) => {
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
    //sorted_recs.forEach((child) => {
    for (let child of recs) {
        var link = `https://t.me/${_e.me.username}?start=DEC-${b64url.encode(`getdetail=${child.id}`)}`
        var line, prefix;

        if (child.type == 'group' || child.type == 'supergroup')
            prefix = '👥'
        else if (child.type == 'channel')
            prefix = '📢'

        if (child.is_public) prefix += '🌐'
        else if (!child.extag || (child.extag && !child.extag['feature:dynlink'])) prefix += '🔐'
        else prefix += '🔒'

        prefix += '|'

        if (child.member_count && !isNaN(child.member_count))
            prefix += `👤 ${child.member_count}|`

        if (child.extag) {
            if (child.extag['official'] == 1) prefix += `<i>【${langres['tagOfficial']}】</i>|`;
            else if (child.extag['official'] == 2) prefix += `<i>【${langres['tagUnOfficial']}】</i>|`;
        }

        if (child.is_public) line = prefix + ` <a href="https://t.me/${child.username}">${he(child.title)}</a>`
        else if (!child.extag || (child.extag && !child.extag['feature:dynlink'])) line = prefix + ` <a href="${child.invite_link}">${he(child.title)}</a>`
        else line = prefix + ` <a href="${link}">${he(child.title)}</a>\n`

        if (!child.extag || (child.extag && !child.extag['feature:dynlink'])) {
            line += `(<a href="${link}">详情</a>) \n`
        }

        head++;
        if (head <= 40) outmsg[outmsg.length - 1] += line;
        else {
            outmsg[outmsg.length] = line;
            head = 1;
        }
    }
    //})
    return outmsg
}

async function getList(msg, result, bot) {
    if (msg.chat.id > 0) {
        try {
            const [is_validated, is_blocked, is_halal, is_nothalal] = await comlib.UserFlag.queryUserFlag(msg.from.id, ['validated', 'block', 'halal', 'nothalal'])
            if (is_halal && !is_nothalal) {
                return bot.sendSticker(msg.chat.id, stickerHalal[Math.floor(Math.random() * stickerHalal.length)])
            }
            const is_in_jvbao = _e.libs['nojvbao_lib'] ? (await _e.libs['nojvbao_lib'].checkUser(msg.from.id)) : false
            if (!(_e.plugins['gpindex_validateuser'] && !is_validated) && !is_blocked && !is_in_jvbao) {
                _ga.tEvent(msg.from, 'listing', 'listing.listTags')
                let row = [],
                    i = 0;
                let col = [];
                tags.forEach((child) => {
                    col.push({
                        text: child
                    });
                    if (col.length == 3) {
                        row.push(col);
                        col = [];
                    }
                })
                if (col.length > 0) {
                    row.push(col);
                    col = [];
                }
                return await bot.sendMessage(msg.chat.id, langres['promptChooseTag'], {
                    reply_to_message_id: msg.message_id,
                    reply_markup: {
                        keyboard: row
                    }
                })
            } else if (is_blocked) {
                _ga.tEvent(msg.from, 'blocked', 'blockedUserAttempt.listing.listTags')
                try {
                    return await bot.sendMessage(msg.chat.id, langres['errorUserBanned'])
                } catch (e) {}
            }
        } catch (e) {
            errorProcess(msg, bot, e)
        }
    }
}

async function sendFirstPageListByCategory(msg, bot) {
    try {
        const [is_validated, is_blocked, is_halal, is_nothalal] = await comlib.UserFlag.queryUserFlag(msg.from.id, ['validated', 'block', 'halal', 'nothalal'])
        if (is_halal && !is_nothalal) {
            return bot.sendSticker(msg.chat.id, stickerHalal[Math.floor(Math.random() * stickerHalal.length)])
        }
        const is_in_jvbao = _e.libs['nojvbao_lib'] ? (await _e.libs['nojvbao_lib'].checkUser(msg.from.id)) : false
        if (!(_e.plugins['gpindex_validateuser'] && !is_validated) && !is_blocked && !is_in_jvbao) {
            _ga.tEvent(msg.from, 'listing', 'listing.listGroups', msg.text)
            const recs = await comlib.getRecByTag(msg.text, null, null, 'count_desc')
            let outmsg = generateList(recs)
            //for (var i = 0; i < outmsg.length; i++) {
            let do_pagination = outmsg.length > 1
            await bot.sendMessage(msg.chat.id, outmsg[0], {
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id,
                disable_web_page_preview: true,
                reply_markup: do_pagination ? {
                    inline_keyboard: [
                        [{
                            text: `第 1 页`,
                            callback_data: `current_page`
                        }, {
                            text: '下一页 >>',
                            callback_data: `next:${msg.text}-1`
                        }]
                    ]
                } : {}
            })
            //}
        } else if (is_blocked) {
            _ga.tEvent(msg.from, 'blocked', 'blockedUserAttempt.listing.listGroup')
            try {
                return await bot.sendMessage(msg.chat.id, langres['errorUserBanned'])
            } catch (e) {}
        }
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

async function processText(msg, type, bot) {
    if (!comlib.getLock(msg.from.id) && msg.chat.id > 0 && tags.indexOf(msg.text) > -1 && !msg.forward_from_chat)
        return sendFirstPageListByCategory(msg, bot)
}

async function pagination_editListByCategory(msg, bot, operator, query) {
    try {
        const [is_validated, is_blocked, is_halal, is_nothalal] = await comlib.UserFlag.queryUserFlag(msg.from.id, ['validated', 'block', 'halal', 'nothalal'])
        const is_in_jvbao = _e.libs['nojvbao_lib'] ? (await _e.libs['nojvbao_lib'].checkUser(msg.from.id)) : false
        if (!(_e.plugins['gpindex_validateuser'] && !is_validated) && !is_blocked && (!is_halal || is_nothalal) && !is_in_jvbao) {
            const [category, current_page] = query.split('-')
            const recs = await comlib.getRecByTag(category, null, null, 'count_desc')
            let outmsg = generateList(recs)
            let this_page
            if (operator == 'prev') this_page = parseInt(current_page) - 1
            else if (operator == 'next') this_page = parseInt(current_page) + 1
            if (this_page < 0 || this_page > outmsg.length) {
                return await bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: ''
                })
            }
            let buttons = []
            if (this_page > 1) {
                buttons.push({
                    text: `<< 上一页`,
                    callback_data: `prev:${category}-${this_page}`
                })
            }
            buttons.push({
                text: `第 ${this_page} 页`,
                callback_data: `current_page`
            })
            if (this_page < outmsg.length) {
                buttons.push({
                    text: `下一页 >>`,
                    callback_data: `next:${category}-${this_page}`
                })
            }
            await bot.editMessageText(outmsg[this_page - 1], {
                parse_mode: 'HTML',
                chat_id: msg.message.chat.id,
                message_id: msg.message.message_id,
                disable_web_page_preview: true,
                reply_markup: buttons.length > 0 ? {
                    inline_keyboard: [
                        buttons
                    ]
                } : {}
            })
            return await bot.answerCallbackQuery({
                callback_query_id: msg.id,
                text: ''
            })
        } else if (is_blocked) {
            _ga.tEvent(msg.from, 'blocked', 'blockedUserAttempt.listing.listGroup')
            try {
                return await bot.answerCallbackQuery({
                    callback_query_id: msg.id,
                    text: ''
                })
            } catch (e) {}
        }
    } catch (e) {
        if (!e.message.match('message is not modified') && !e.message.match('QUERY_ID_INVALID'))
            errorProcess(msg.message, bot, e)
    }
}

async function doSearch(msg, result, bot) {
    if (tags.indexOf(msg.text) > -1) return
    if (msg.forward_from_chat) return
    if (!comlib.getLock(msg.from.id) && msg.chat.id > 0) {
        try {
                const [is_validated, is_blocked, is_halal, is_nothalal] = await comlib.UserFlag.queryUserFlag(msg.from.id, ['validated', 'block', 'halal', 'nothalal'])
            if (is_halal && !is_nothalal) {
                return bot.sendSticker(msg.chat.id, stickerHalal[Math.floor(Math.random() * stickerHalal.length)])
            }
            const is_in_jvbao = _e.libs['nojvbao_lib'] ? (await _e.libs['nojvbao_lib'].checkUser(msg.from.id)) : false
            if (!(_e.plugins['gpindex_validateuser'] && !is_validated) && !is_blocked && !is_in_jvbao) {
                let recs = await comlib.searchByName(result[1], null, null, 'count_desc')
                recs = recs.filter(record => tags.indexOf(record.tag) > -1)
                if (recs.length > 0) {
                    if (recs.length > 40) {
                        _ga.tEvent(msg.from, 'listing', 'listing.doSearchMatch.tooMany')
                        return await bot.sendMessage(msg.chat.id, langres['errorTooManyItems'], {
                            reply_to_message_id: msg.message_id,
                            disable_web_page_preview: true,
                            reply_markup: {
                                inline_keyboard: [[{
                                    text: langres['buttonUseInline'],
                                    switch_inline_query_current_chat: result[1]
                                }]]
                            }
                        })
                    }
                    _ga.tEvent(msg.from, 'listing', 'listing.doSearchMatch')
                    let outmsg = generateList(recs)
                    for (var i = 0; i < outmsg.length; i++) {
                        await bot.sendMessage(msg.chat.id, outmsg[i], {
                            parse_mode: 'HTML',
                            reply_to_message_id: msg.message_id,
                            disable_web_page_preview: true
                        })
                    }
                } else {
                    _ga.tEvent(msg.from, 'listing', 'listing.doSearchNoMatch')
                    try {
                        return await bot.sendMessage(msg.chat.id, langres['errorNoSearchMatchCriteria'])
                    } catch (e) {}
                }
            } else if (is_blocked) {
                bot.sendMessage(msg.chat.id, langres['errorUserBanned']);
                _ga.tEvent(msg.from, 'blocked', 'blockedUserAttempt.listing.doSearch')
            }
        } catch (e) {
            errorProcess(msg, bot, e)
        }
    }
}


async function getDetail(msg, result, bot) {
    if (msg.chat.id < 0) return
    try {
        const [is_validated, is_blocked, is_halal, is_nothalal] = await comlib.UserFlag.queryUserFlag(msg.from.id, ['validated', 'block', 'halal', 'nothalal'])
        if (is_halal && !is_nothalal) {
            return bot.sendSticker(msg.chat.id, stickerHalal[Math.floor(Math.random() * stickerHalal.length)])
        }
        const is_in_jvbao = _e.libs['nojvbao_lib'] ? (await _e.libs['nojvbao_lib'].checkUser(msg.from.id)) : false
        if (!(_e.plugins['gpindex_validateuser'] && !is_validated) && !is_blocked && !is_in_jvbao) {
            const record = await comlib.getRecord(result[1])
            if (!record) {
                return await bot.sendMessage(msg.chat.id, langres['errorGroupNotExist']);
            } else {
                _ga.tEvent(msg.from, 'listing', 'listing.getGroupDetail')
                let officialstate = ''
                if (record.extag['official']) {
                    switch (parseInt(record.extag['official'])) {
                        case 1:
                            officialstate = '\n' + langres['noteOfficial']
                            break
                        case 2:
                            officialstate = '\n' + langres['noteUnOfficial']
                            break
                    }
                }
                if (record.is_public) {
                    let message
                    if (record.type == "channel") {
                        message = util.format(langres['infoPubChan'], record.id, record.title, record.username, record.tag + officialstate, record.desc)
                    } else {
                        message = util.format(langres['infoPubGroup'], record.id, record.title, record.username, record.tag + officialstate, record.desc)
                    }
                    return await bot.sendMessage(msg.chat.id, message, {
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: langres['buttonJoin'],
                                    url: 'https://t.me/' + record.username
                                }, {
                                    text: langres['buttonShare'],
                                    switch_inline_query: `##${record.id}`
                                }],
                                [{
                                    text: langres['buttonReport'],
                                    callback_data: 'reportinvalid:' + record.id
                                }]
                            ]
                        },
                        disable_web_page_preview: true
                    });
                } else /* record is private */ {
                    let invite_link
                    let message = record.type == "channel" ?
                        util.format(langres['infoPrivChan'], record.id, record.title, record.tag + officialstate, record.desc) :
                        util.format(langres['infoPrivGroup'], record.id, record.title, record.tag + officialstate, record.desc)
                    if (record.extag && record.extag['feature:dynlink']) {
                        let dynlink = await getDynLink(record.id, bot)
                        if (dynlink) {
                            invite_link = dynlink
                            message += '\n\n本群组受动态链接保护，链接最长 5 分钟失效，请尽快使用。\n刚生成的动态链接可能无法使用，请等 30 秒再加入或是重新生成一个新的链接。'
                        } else {
                            invite_link = record.invite_link
                            message += '\n\n动态链接生成失败，当前为数据库缓存链接。我们会尽快调查此事件。'
                            console.log(`Failed to generate dynlink for id: ${record.id}  ${dynlink}`)
                            await bot.sendMessage(admin_id, `Failed to generate dynlink for id: ${record.id}`);
                        }
                    } else {
                        invite_link = record.invite_link
                    }
                    return await bot.sendMessage(msg.chat.id, message, {
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: langres['buttonJoin'],
                                    url: invite_link
                                }, {
                                    text: langres['buttonShare'],
                                    switch_inline_query: `##${record.id}`
                                }],
                                [{
                                    text: langres['buttonReport'],
                                    callback_data: 'reportinvalid:' + record.id
                                }]
                            ]
                        },
                        disable_web_page_preview: true
                    })
                }
            }
        } else if (is_blocked) {
            _ga.tEvent(msg.from, 'blocked', 'blockedUserAttempt.listing.getGroupDetail')
            try {
                return await bot.sendMessage(msg.chat.id, langres['errorUserBanned'])
            } catch (e) {}
        }
    } catch (e) {
        errorProcess(msg, bot, e)
    }
}

async function getMyGroups(msg, result, bot) {
    function generateList(recs) {
        let outmsg = []
        outmsg[0] = ''
        var head = 0
        recs.forEach((child) => {
            var link = `https://t.me/${_e.me.username}?start=DEC-${b64url.encode(`panel=${child.id}`)}`
            var line, prefix;
            if (child.type == 'group' || child.type == 'supergroup')
                prefix = '👥'
            else if (child.type == 'channel')
                prefix = '📢'
            if (child.is_public) prefix += '🌐'
            else if (!child.extag || (child.extag && !child.extag['feature:dynlink'])) prefix += '🔐'
            else prefix += '🔒'
            prefix += '|'
            line = prefix + ` <a href="${link}">${he(child.title)}</a>\n`
            head++;
            if (head <= 40) outmsg[outmsg.length - 1] += line;
            else {
                outmsg[outmsg.length] = line;
                head = 1;
            }
        })
        return outmsg
    }
    if (msg.chat.id > 0) {
        try {
            _ga.tEvent(msg.from, 'listing', 'listing.getMyGroups')
            const recs = await comlib.getRecByCreator(msg.from.id)
            var out = '';
            if (Array.isArray(recs) && recs.length > 0)
                recs.forEach((rec) => {
                    var line;
                    line = rec.id;
                    line += ' - ';
                    line += rec.title + ` (#${rec.tag}): \n`;
                    line += rec.is_public ? '@' + rec.username : rec.invite_link;
                    out += line + '\n\n';
                });
            else out = langres['errorNoMyGroups']
            return await bot.sendMessage(msg.chat.id, out, {
                reply_to_mesaage_id: msg.message_id
            })
        } catch (e) {
            errorProcess(msg, bot, e)
        }
    }
}

async function processCBButton(msg, type, bot) {
    const [operator, query] = msg.data.split(':')
    if (['prev', 'next'].indexOf(operator) > -1)
        pagination_editListByCategory(msg, bot, operator, query)
    else if (operator == 'current_page') {
        await bot.answerCallbackQuery({
            callback_query_id: msg.id,
            text: ''
        })
    }
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    run: [
        [/^\/list$/, getList],
        ['text', processText],
        [/^\/start getdetail=([0-9-]{6,})/, getDetail],
        //[/^\/getdetail ([0-9-]{6,})/, getDetail],
        [/^\/mygroups$/, getMyGroups],
        [/^([^/].*)$/, doSearch],
        ['callback_query', processCBButton]
    ]
}
