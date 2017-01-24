'use strict';

function writeHelp(msg, result, bot) {
    if (msg.chat.id > 0){
        var helptext = '欢迎使用 Telegram zh_CN 姐妹项目 —— 全自动群组娘 v0.6.7\n\n使用 /list 指令查阅当前收录群组(仅私聊)，\n/enroll 指令提交群组(仅私聊, 仅群主)\n出了问题、没有反应或想隐藏键盘？请使用 /cancel 指令\n查看全部命令请输入 / 查阅 Telegram 自带命令列表。\n\n项目频道: @zh_groups\n项目支持群组: https://telegram.me/joinchat/BMh6Qz1-oSL2CnFbU_Z4Lg\n原组织频道: @transfortelegram\n\n使用前，请仔细阅读最终用户使用协议：\nhttp://telegra.ph/The-Telegram-Group-Index-Projects-Terms-of-Service-01-19';
        bot.sendMessage(msg.chat.id, helptext, {
            reply_to_message_id: msg.message_id
        });
    }
}

module.exports = {
    run: [
        [/^\/start$/, writeHelp],
        [/^\/help$/, writeHelp],
    ]
}
