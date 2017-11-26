var comlib

async function removeBot(msg, type, bot) {
    const is_enabled = !!(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:antibot'))
    if (is_enabled) {
        const is_groupadmin = (['creator', 'administrator'].indexOf((await bot.getChatMember(msg.chat.id, msg.from.id)).status) > -1)
        if (is_groupadmin) return
        for (let bot of msg.new_chat_members) {
            if (bot.is_bot) {
                try {
                    await bot.kickChatMember(msg.chat.id, bot.id)
                } catch (e) {

                }
            }
        }
    }

}

module.exports = {
    init: (e) => {
        comlib = e.libs['gpindex_common'];
    },
    run: [
        ['new_chat_members', removeBot]
    ]
}
