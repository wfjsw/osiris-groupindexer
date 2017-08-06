'use strict';

const util = require('util');
const he = require('he');
const tags = require('../config.gpindex.json')['gpindex_tags']
const langres = require('../resources/gpindex_listing.json');
const admin_id = require('../config.gpindex.json')['gpindex_admin'];

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
    bot.sendMessage(admin_id, errorlog, {
        parse_mode: 'Markdown'
    });
    purgeState(msg, 'errrpt', bot);
}

async function generateDynLink(gid, bot) {
    try {
        const new_link = await bot.exportChatInviteLink(gid)
        dynlink_cache[gid] = {
            time: new Date().valueOf(),
            link: new_link,
            displayed: false
        }
        return new_link
    } catch (e) {
        console.error(e)
        var errorlog = '```\n' + e.stack + '```\n';
        await bot.sendMessage(admin_id, errorlog, {
            parse_mode: 'Markdown'
        });
        return false
    }
}

async function getDynLink(gid, bot) {
    if (dynlink_cache[gid]) {
        if ((new Date().valueOf() - dynlink_cache[gid].time) < 5 * 60 * 1000)
            return dynlink_cache[gid].link
        else if (!dynlink_cache[gid].displayed) {
            dynlink_cache[gid].displayed = true
            setTimeout(generateDynLink, 5 * 60 * 1000, gid, bot)
            return dynlink_cache[gid].link
        } else if ((new Date().valueOf() - dynlink_cache[gid].time) < 7 * 60 * 1000) {
            const link = await generateDynLink(gid, bot)
            setTimeout(generateDynLink, 5 * 60 * 1000, gid, bot)
            return link
        }
    } else {
        const link = await generateDynLink(gid, bot)
        setTimeout(generateDynLink, 5 * 60 * 1000, gid, bot)
        return link
    }
}

function generateList(recs) {
    let outmsg = []
    outmsg[0] = ''
    var head = 0
    recs.forEach((child) => {
        var link = `https://t.me/${_e.me.username}?start=getdetail=${child.id}`
        var line, prefix;

        if (child.type == 'group' || child.type == 'supergroup')
            prefix = '👥'
        else if (child.type == 'channel')
            prefix = '📢'

        if (child.is_public) prefix += '🌐'
        else if (child.extag && !child.extag['feature:dynlink']) prefix += '🔐'
        else prefix += '🔒'

        prefix += '|'

        if (child.extag) {
            if (child.extag['official'] == 1) prefix += `<i>【${langres['tagOfficial']}】</i>|`;
            else if (child.extag['official'] == 2) prefix += `<i>【${langres['tagUnOfficial']}】</i>|`;
        }

        if (child.is_public) line = prefix + ` <a href="https://t.me/${child.username}">${he.encode(child.title)}</a>`
        else if (child.extag && !child.extag['feature:dynlink']) line = prefix + ` <a href="${child.invite_link}">${he.encode(child.title)}</a>`
        else line = prefix + ` <a href="${link}">${he.encode(child.title)}</a>\n`

        if (child.extag && !child.extag['feature:dynlink']) {
            line += `(<a href="${link}">详情</a>) \n`
        }

        head++;
        if (head <= 40) outmsg[outmsg.length - 1] += line;
        else {
            outmsg[outmsg.length] = line;
            head = 1;
        }
    })
    return outmsg
}

async function getList(msg, result, bot) {
    if (msg.chat.id > 0) {
        try {
            const is_validated = await comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
            const is_blocked = await comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
            if (is_validated && !is_blocked) {
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

async function sendListByCategory(msg, bot) {
    try {
        const is_validated = await comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
        const is_blocked = await comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
        if (is_validated && !is_blocked) {
            _ga.tEvent(msg.from, 'listing', 'listing.listGroups', msg.text)
            const recs = await comlib.getRecByTag(msg.text)
            let outmsg = generateList(recs)
            for (var i = 0; i < outmsg.length; i++) {
                await bot.sendMessage(msg.chat.id, outmsg[i], {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id,
                    disable_web_page_preview: true
                })
            }
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
    if (!comlib.getLock(msg.from.id) && msg.chat.id > 0 && tags.indexOf(msg.text) > -1)
        return sendListByCategory(msg, bot)
}

async function doSearch(msg, result, bot) {
    if (!comlib.getLock(msg.from.id) && msg.chat.id > 0) {
        try {
            const is_validated = await comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
            const is_blocked = await comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
            if (is_validated && !is_blocked) {
                const recs = await comlib.searchByName(result[1])
                if (recs.length > 0) {
                    if (recs.length > 40) {
                        _ga.tEvent(msg.from, 'listing', 'listing.doSearchMatch.tooMany')
                        return await bot.sendMessage(msg.chat.id, langres['errorTooManyItems'], {
                            reply_to_message_id: msg.message_id,
                            disable_web_page_preview: true
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
    try {
        const is_validated = await comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
        const is_blocked = await comlib.UserFlag.queryUserFlag(msg.from.id, 'block')
        if (is_validated && !is_blocked) {
            const record = await comlib.getRecord(result[1])
            if (!record) {
                return await bot.sendMessage(msg.chat.id, langres['errorGroupNotExist']);
            } else {
                _ga.tEvent(msg.from, 'listing', 'listing.getGroupDetail')
                if (record.is_public) {
                    let message
                    if (record.type == "channel") {
                        message = util.format(langres['infoPubChan'], record.id, record.title, record.username, record.tag, record.desc)
                    } else {
                        message = util.format(langres['infoPubGroup'], record.id, record.title, record.username, record.tag, record.desc)
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
                    let message = util.format(langres['infoPrivGroup'], record.id, record.title, record.tag, record.desc)
                    if (record.extag && record.extag['feature:dynlink']) {
                        let dynlink = await getDynLink(record.id, bot)
                        if (dynlink) {
                            invite_link = dynlink
                            message += '\n\n本群组受动态链接保护，链接 5 分钟后失效，请尽快使用。'
                        } else {
                            invite_link = record.invite_link
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
            else out = 'No Groups.'
            return await bot.sendMessage(msg.chat.id, out, {
                reply_to_mesaage_id: msg.message_id
            })
        } catch (e) {
            errorProcess(msg, bot, e)
        }
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
        [/^\/getdetail ([0-9-]{6,})/, getDetail],
        [/^\/mygroups$/, getMyGroups],
        [/^\/search (.+)$/, doSearch],
    ]
}
