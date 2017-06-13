'use strict';

var _ga;

function writeHelp(msg, result, bot) {
    if (msg.chat.id > 0){
        _ga.tEvent(msg.from.id, 'init', 'startBot')
        var helptext = '欢迎使用 Telegram zh_CN 姐妹项目 —— 全自动群组娘 v0.8.2\n\n使用 /list 指令查阅当前收录群组(仅私聊)，\n/enroll 指令提交群组(仅私聊, 仅群主)\n出了问题、没有反应或想隐藏键盘？请使用 /cancel 指令\n查看全部命令请输入 / 查阅 Telegram 自带命令列表。\n\n项目频道: @zh_groups\n\n使用前，请仔细阅读最终用户使用协议：\nhttp://telegra.ph/The-Telegram-Group-Index-Projects-Terms-of-Service-01-19';
        bot.sendMessage(msg.chat.id, helptext, {
            reply_to_message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{text: '获取社区帮助', url: 'https://t.me/zh_CN/294'}],
                    [{text: '获取汉化文件', url: 'https://t.me/zh_CN'}]
                ]}
        }).catch((e) => {
            _ga.tException(msg.from.id, e.description, true)
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
