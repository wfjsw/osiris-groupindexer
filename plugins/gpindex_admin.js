'use strict';

var _e;

function writeMenu(msg, result, bot) {

}

function addCategory(msg, result, bot) {
    // TODO
}

function removeItem(msg, result, bot) {
    _e.libs['gpindex_common'].doRemoval(result[1])
    .then((ret) => {
        bot.sendMessage(msg.chat.id, 'Success');
    })
    .catch((e) => {
        bot.sendMessage(msg.chat.id, 'Failed\n\n' + require('util').inspect(e));
    })
}

function markInvaild(msg, result, bot) {
    // TODO
    _e.libs['gpindex_common'].getRecord(result[1])
    .then((ret) => {
        if (ret) {
            return bot.sendMessage(ret.creator, '您的群组 ' + ret.title + ' 链接已过期，请及时更新。');
        } else {
            bot.sendMessage(msg.from.id, 'Not Found');
        }
    }).then((msg) => {
        bot.sendMessage(msg.from.id, 'Done.');
    }).catch((e) => {
        bot.sendMessage(msg.chat.id, 'Failed\n\n' + require('util').inspect(e));
    })
}

module.exports = {
    init: (e) => {
        _e = e;
    },
    run: [
        [/^\/writemenu/, writeMenu],
        [/^\/addcategory (.*)$/, addCategory],
        [/^\/removeitem ([0-9-]{6,}$/, removeItem],
        [/^\/markinvaild ([0-9-]{6,})$/, markInvaild]
    ]
}