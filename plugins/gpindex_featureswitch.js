var _e, comlib, _ga
const admin_id = require('../config.gpindex.json')['gpindex_admin'];


/* Feature List
 * nospam
 * noblue
 * dynlink
 */


async function noSpam(msg, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(msg.from, 'featureswitch', 'featureswitch.noSpam.enabled')
            await comlib.GroupExTag.setGroupExTag(msg.chat.id, 'feature:nospam_disabled', 0)
            break
        case 'disable':
            _ga.tEvent(msg.from, 'featureswitch', 'featureswitch.noSpam.disabled')
            await comlib.GroupExTag.setGroupExTag(msg.chat.id, 'feature:nospam_disabled', 1)
            break
    }
    return await bot.sendMessage(msg.chat.id, '已成功更改。', {
        reply_to_message_id: msg.message_id
    })
}

async function noBlue(msg, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(msg.from, 'featureswitch', 'featureswitch.noBlue.enabled')
            await comlib.GroupExTag.setGroupExTag(msg.chat.id, 'feature:noblue_disabled', 0)
            break
        case 'disable':
            _ga.tEvent(msg.from, 'featureswitch', 'featureswitch.noBlue.disabled')
            await comlib.GroupExTag.setGroupExTag(msg.chat.id, 'feature:noblue_disabled', 1)
            break
    }
    return await bot.sendMessage(msg.chat.id, '已成功更改。', {
        reply_to_message_id: msg.message_id
    })
}

async function dynLink(msg, bot, operator) {
    if (msg.chat.username) {
        return await bot.sendMessage(msg.chat.id, '抱歉，该功能仅对私有群组有效。', {
            reply_to_message_id: msg.message_id
        })
    }
    switch (operator) {
        case 'enable':
            _ga.tEvent(msg.from, 'featureswitch', 'featureswitch.dynLink.enabled')
            await comlib.GroupExTag.setGroupExTag(msg.chat.id, 'feature:dynlink', 1)
            return await bot.sendMessage(msg.chat.id, '已成功启用动态链接。\n在动态链接启用时，请确保机器人在群中任管理员，且具有 Add Users 权限。', {
                reply_to_message_id: msg.message_id
            })
        case 'disable':
            _ga.tEvent(msg.from, 'featureswitch', 'featureswitch.dynLink.disabled')
            await comlib.GroupExTag.setGroupExTag(msg.chat.id, 'feature:dynlink', 0)
            return await bot.sendMessage(msg.chat.id, '已成功关闭。', {
                reply_to_message_id: msg.message_id
            })
    }
}

async function inGroupValidation(msg, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(msg.from, 'featureswitch', 'featureswitch.inGroupValidation.enabled')
            await comlib.GroupExTag.setGroupExTag(msg.chat.id, 'feature:ingroupvalidation', 1)
            return await bot.sendMessage(msg.chat.id, '已成功启用加群防清真验证。\n在加群防清真验证启用时，请确保机器人在群中任管理员，且具有 Ban Users 权限。', {
                reply_to_message_id: msg.message_id
            })
        case 'disable':
            _ga.tEvent(msg.from, 'featureswitch', 'featureswitch.inGroupValidation.disabled')
            await comlib.GroupExTag.setGroupExTag(msg.chat.id, 'feature:ingroupvalidation', 0)
            return await bot.sendMessage(msg.chat.id, '已成功关闭。', {
                reply_to_message_id: msg.message_id
            })
    }
}


async function switchFeature(msg, result, bot) {
    if (msg.chat.id > 0) return
    const record = await comlib.getRecord(msg.chat.id)
    if (!record) return
    const is_superadmin = !(['left', 'kicked'].indexOf((await bot.getChatMember(admin_id, msg.from.id)).status) > -1)
    const is_admin = ['creator', 'administrator'].indexOf((await bot.getChatMember(msg.chat.id, msg.from.id)).status) > -1
    if (!is_admin && !is_superadmin) return
    const [operator, feature_name] = result.slice(1)
    switch (feature_name) {
        case 'nospam':
            return noSpam(msg, bot, operator)
        case 'noblue':
            return noBlue(msg, bot, operator)
        case 'dynlink':
            return dynLink(msg, bot, operator)
        case 'ingroupvalidation':
            return inGroupValidation(msg, bot, operator)
    }
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    run: [
        [/^\/(enable|disable) ([^\s]+)/, switchFeature]
    ]
}
