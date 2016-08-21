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