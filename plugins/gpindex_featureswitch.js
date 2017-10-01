var _e, comlib, _ga
const admin_id = require('../config.gpindex.json')['gpindex_admin'];


/* Feature List
 * nospam
 * noblue
 * dynlink
 */


async function noSpam(user, gid, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.noSpam.enabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:nospam_disabled', 0)
            break
        case 'disable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.noSpam.disabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:nospam_disabled', 1)
            break
    }
    return '已成功更改。'
}

async function noBlue(user, gid, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.noBlue.enabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:noblue_disabled', 0)
            return '已成功启用机器人命令自动删除。必需权限：Delete Messages'
        case 'disable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.noBlue.disabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:noblue_disabled', 1)
            return '已成功关闭。'
    }
}

async function dynLink(user, gid, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.dynLink.enabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:dynlink', 1)
            return '已成功启用动态链接。\n在动态链接启用时，请确保机器人在群中任管理员，且具有 Add Users 权限。'
        case 'disable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.dynLink.disabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:dynlink', 0)
            return '已成功关闭。'
    }
}

async function inGroupValidation(user, gid, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.inGroupValidation.enabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:ingroupvalidation', 1)
            return '已成功启用加群防清真验证。\n在加群防清真验证启用时，请确保机器人在群中任管理员，且具有 Ban Users 权限。'
        case 'disable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.inGroupValidation.disabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:ingroupvalidation', 0)
            return '已成功关闭。'
    }
}

async function antiServiceMessage(user, gid, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.antiServiceMsg.enabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:deljoin', 1)
            return '已成功启用加群消息自动删除。必需权限：Delete Messages'
        case 'disable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.antiServiceMsg.disabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:deljoin', 0)
            return '已成功关闭。'
    }
}

async function antiHalal(user, gid, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.antiHalal.enabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:antihalal', 1)
            return '已成功启用防清真组件。必需权限：Ban Users, Delete Messages\n\n使用前请先阅读说明：'
        case 'disable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.antiHalal.disabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:antihalal', 0)
            return '已成功关闭。'
    }
} async function antiHalalEnhanced(user, gid, bot, operator) {
    switch (operator) {
        case 'enable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.antiHalalEnhanced.enabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:antihalalenhanced', 1)
            return '已成功启用防清真增强组件。本组件必须在 antihalal 组件启用后才能发挥效果。必需权限：Ban Users, Delete Messages'
        case 'disable':
            _ga.tEvent(user, 'featureswitch', 'featureswitch.antiHalalEnhanced.disabled')
            await comlib.GroupExTag.setGroupExTag(gid, 'feature:antihalalenhanced', 0)
            return '已成功关闭。'
    }
}

async function switchFeature(user, gid, operator, feature_name, bot) {
    switch (feature_name) {
        case 'nospam':
            return noSpam(user, gid, bot, operator)
        case 'noblue':
            return noBlue(user, gid, bot, operator)
        case 'dynlink':
            return dynLink(user, gid, bot, operator)
        //case 'ingroupvalidation':
        //    return inGroupValidation(user, gid, bot, operator)
        case 'deljoin':
            return antiServiceMessage(user, gid, bot, operator)
        case 'antihalal':
            return antiHalal(user, gid, bot, operator)
        case 'antihalalenhanced':
            return antiHalalEnhanced(user, gid, bot, operator)
        default:
            return await bot.sendMessage(gid, '请阅读管理功能说明书\nhttps://wfjsw.gitbooks.io/tgcn-groupindex-reference/content/administration-functions.html')
    }
}

async function switchFeatureCmd(msg, result, bot) {
    if (msg.chat.id > 0) return
    const record = await comlib.getRecord(msg.chat.id)
    if (!record) {
        const message = await bot.sendMessage(msg.chat.id, '受到存储位置限制，只有索引中的群组才能对管理功能进行调整。', {
            reply_to_message_id: msg.message_id
        })
        return setTimeout(() => {
            bot.deleteMessage(msg.chat.id, message.message_id)
                .catch(() => {})
        }, 15 * 1000)
    }
    const is_superadmin = !(['left', 'kicked'].indexOf((await bot.getChatMember(admin_id, msg.from.id)).status) > -1)
    const is_admin = ['creator', 'administrator'].indexOf((await bot.getChatMember(msg.chat.id, msg.from.id)).status) > -1
    if (!is_admin && !is_superadmin) {
        const message = await bot.sendMessage(msg.chat.id, '只有群组创建者和管理员才能对管理功能进行调整。', {
            reply_to_message_id: msg.message_id
        })
        return setTimeout(() => {
            bot.deleteMessage(msg.chat.id, message.message_id)
                .catch(() => {})
        }, 15 * 1000)
    }
    const [operator, feature_name] = result.slice(1)
    if (feature_name == 'dynlink' && msg.chat.username) {
        return '抱歉，该功能仅对私有群组有效。'
    }
    const reply = await switchFeature(msg.from, msg.chat.id, operator, feature_name, bot)
    return await bot.sendMessage(msg.chat.id, reply, {
        reply_to_message_id: msg.message_id
    })
}

async function helpFeatureCmd(msg, result, bot) {
    const is_superadmin = !(['left', 'kicked'].indexOf((await bot.getChatMember(admin_id, msg.from.id)).status) > -1)
    const is_admin = ['creator', 'administrator'].indexOf((await bot.getChatMember(msg.chat.id, msg.from.id)).status) > -1
    if (!is_admin && !is_superadmin) return
    return await bot.sendMessage(msg.chat.id, '请阅读管理功能说明书\nhttps://wfjsw.gitbooks.io/tgcn-groupindex-reference/content/administration-functions.html', {
        reply_to_message_id: msg.message_id
    })
}

/*
async function switchFeatureButton(msg, type, bot) {
    // feat:[e|d]&gid
    let [realm, query] = msg.query.split(':')
    if (realm != 'feat') return
    let [operator, gid] = query.split('&')
    operator = operator == 'e' ? 'enable' : 'disable'
    gid = parseInt(gid)
    const record = await comlib.getRecord(msg.chat.id)
    if (!record) 
        return await bot.answerCallbackQuery(msg.id, '受到存储位置限制，只有索引中的群组才能对管理功能进行调整。', true)
    const is_superadmin = !(['left', 'kicked'].indexOf((await bot.getChatMember(admin_id, msg.from.id)).status) > -1)
    const is_admin = ['creator', 'administrator'].indexOf((await bot.getChatMember(gid, msg.from.id)).status) > -1
    if (feature_name == 'dynlink' && msg.chat.username) {
        return '抱歉，该功能仅对私有群组有效。'
    }
}
*/

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    run: [
        [/^\/(enable|disable) ([^\s]+)/, switchFeatureCmd],
        [/^\/(enable|disable)$/, helpFeatureCmd]
        // ['callback_query', switchFeatureButton]
    ]
}
