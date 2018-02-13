var comlib

async function checkHate(msg, result, bot) {
    const is_hate = !!(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'hate'))
    if (is_hate)
        return bot.leaveChat(msg.chat.id)
            .catch((e) => {
                console.error(e.message)
            })
}

module.exports = {
    init: e => comlib = e.libs['gpindex_common'],
    run: [
        ['new_chat_members', checkHate]
    ]
}
