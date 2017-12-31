'use strict';

var _ga;

function writeHelp(msg, result, bot) {
    if (msg.chat.id > 0){
        _ga.tEvent(msg.from, 'intro', 'intro.startBot')
        var helptext = '欢迎使用 TGCN-全自动群组频道索引实用工具 v1.5.0\n\n使用 /list 指令查阅当前收录群组(仅私聊)，\n/enroll 指令提交群组(仅私聊, 仅群主)\n请使用 /cancel 指令解决一切玄学问题\n搜索群组请直接输入关键字\n查看全部命令请输入 / 查阅 Telegram 自带命令列表。\n\n项目频道: @zh_groups\n\n使用前，请仔细阅读最终用户使用协议：\nhttp://telegra.ph/The-Telegram-Group-Index-Projects-Terms-of-Service-01-19';
        bot.sendMessage(msg.chat.id, helptext, {
            reply_to_message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{text: '报告问题/获取社区帮助', url: 'https://t.me/zh_CN/294'}],
                    [{ text: 'Telegram 中文汉化文件', url: 'https://t.me/zh_CN' }],
                    [{ text: '进阶使用手册', url: 'https://wfjsw.gitbooks.io/tgcn-groupindex-reference/content/'}]
                ]}
        }).catch((e) => {
            _ga.tException(msg.from, e, true)
        })
    }
}

module.exports = {
    init: (e) => {
        _ga = e.libs['ga'];
    },
    run: [
        [/^\/start$/, writeHelp],
        [/^\/help$/, writeHelp],
    ]
}
