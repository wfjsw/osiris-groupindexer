'use strict';

function writeHelp(msg, result, bot) {
    var helptext = '欢迎使用 Telegram zh_CN 姐妹项目 —— 全自动群组娘 v0.6.0\n\n使用 /list 指令查阅当前收录群组(仅私聊)， /enroll 指令提交群组(仅私聊, 仅群主)\n查看全部命令请输入 / 查阅 Telegram 自带命令列表。\n\n项目频道: @zh_groups\n项目支持群组: https://telegram.me/joinchat/BMh6Qz1-oSL2CnFbU_Z4Lg\n原组织频道: @transfortelegram';
    bot.sendMessage(msg.chat.id, helptext);
}

module.exports = {
    run: [
        [/^\/start$/, writeHelp],
        [/^\/help$/, writeHelp],
    ]
}