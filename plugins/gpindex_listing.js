'use strict';

const util = require('util');
const he = require('he');
const tags = require('../config.json')['gpindex_tags']
const langres = require('../resources/gpindex_listing.json');
const admin_id = require('../config.json')['gpindex_admin'];

var _e;

// TODO
function getList(msg, result, bot) {
    if (msg.chat.id > 0) {
        var markup = [];
        tags.forEach((child) => {
            markup.push([{text: child}]);
        })
        bot.sendMessage(msg.chat.id, langres['promptChooseTag'], {
            reply_markup: {keyboard: markup}
        })
    }
}

function processText(msg, result, bot) {
    if (!_e.libs['gpindex_common'].getLock(msg.from.id) && msg.chat.id > 0) {
        if (tags.indexOf(msg.text) > -1) {
            _e.libs['gpindex_common'].getRecByTag(msg.text)
            .then((recs) => {
                var out = langres['infoGroups'];
                recs.forEach((child) => {
                    var link = 'https://telegram.me/' + _e.me.username + '?start=getdetail@' + child.id;
                    //out += util.format('<a href="%s">%s</a>\n', link, he.encode(child.title));
                    if (child.is_public) out += util.format('<a href="https://telegram.me/%s">%s</a> (<a href="%s">详情</a>)\n', child.username, he.encode(child.title), link);
                    else out += util.format('<a href="%s">%s</a> (<a href="%s">详情</a>)\n', child.invite_link, he.encode(child.title), link);
                })
                bot.sendMessage(msg.chat.id, out, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                }).catch((e) => {
                    var errorlog = '```\n' + util.inspect(e) + '```\n';
                    bot.sendMessage(msg.chat.id, '发生了一些错误。我们已将错误日志发送至管理员。');
                    bot.sendMessage(admin_id, errorlog, {
                        parse_mode: 'Markdown'
                    });
                })
            })
        }
    }
}

function getDetail(msg, result, bot) {
    _e.libs['gpindex_common'].getRecord(result[1])
    .then((ret) => {
        if (!ret) {
            bot.sendMessage(msg.chat.id, langres['errorGroupNotExist']);
        } else {
            if (ret.is_public) 
                bot.sendMessage(msg.chat.id, util.format(langres['infoPubGroup'], ret.id, ret.title, ret.username, ret.tag, ret.desc), {
                    reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: 'https://telegram.me/' + ret.username}]]}
                });
            else 
                bot.sendMessage(msg.chat.id, util.format(langres['infoPrivGroup'], ret.id, ret.title, ret.invite_link, ret.tag, ret.desc), {
                    reply_markup: {inline_keyboard:[[{text: langres['buttonJoin'], url: ret.invite_link}]]}
                });
        }
    }).catch((e) => {
        var errorlog = '```\n' + util.inspect(e) + '```\n';
        bot.sendMessage(msg.chat.id, '发生了一些错误。');
        bot.sendMessage(admin_id, errorlog, {
            parse_mode: 'Markdown'
        });
    })
}

module.exports = {
    init: (e) => {
        _e = e;
    },
    run: [
        [/^\/list$/, getList],
        ['text', processText],
        [/^\/start getdetail@([0-9-]{6,})/, getDetail],
        [/^\/getdetail ([0-9-]{6,})/, getDetail]
    ]
}
