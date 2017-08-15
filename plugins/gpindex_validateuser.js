const {
    JSDOM
} = require("jsdom");

const ADMIN_GROUP = require('../config.gpindex.json')['gpindex_admin'];

const langCodeAllowed = []/*['zh-CN', 'zh-Hans-CN', 'zh-TW', 'zh-Hans-JP',
    'zh-Hans-US', 'zh-Hant-HK', 'en-HK', 'zh-HK', 'zh-Hant-TW',
    'zh-Hant-US', 'zho', 'en-CN', 'zh-Hans-HK', 'en-HK', 'zh',
    'zh-Hans-DE', 'zh-Hant-UK', "zh-Hans", "zh-Hant", 'zh-Hans-GB',
    'zh@collation=pinyin', 'zh-Hans-NL', 'zh-Hans-CA']*/
const langCodeBanned = ['fa-IR']

var _e, comlib, _ga
var cache_time = 0
var allowed_answer = []

function process(msg, type, bot) {
    if (msg.chat.id > 0) {
        comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
            .then(ret => {
                if (!ret) {
                    if (langCodeAllowed.indexOf(msg.from.language_code) > -1) {
                        _ga.tEvent(msg.from, 'validateuser', 'validateuser.languageHit')
                        bot.sendMessage(msg.from.id, '自动验证通过，欢迎使用群组索引服务。\n\n您需要重新进行刚才的操作。')
                        return comlib.UserFlag.setUserFlag(msg.from.id, 'validated', 1)
                    } else if (langCodeBanned.indexOf(msg.from.language_code) > -1) {
                        _ga.tEvent(msg.from, 'validateuser', 'validateuser.languageBanned')
                        bot.forwardMessage(-1001149888177, msg.chat.id, msg.message_id)
                        bot.sendMessage(ADMIN_GROUP, `${msg.from.language_code} user: ${msg.from.id}`)
                        bot.sendMessage(msg.from.id, '抱歉，您无权使用此服务。')
                        return comlib.UserFlag.setUserFlag(msg.from.id, 'block', 1)
                    } else if (allowed_answer.indexOf(msg.text
                        .replace(/people\.cn/, 'people.com.cn')
                        .replace(/https:\/\//, 'http://')
                        .trim()) > -1) {
                        _ga.tEvent(msg.from, 'validateuser', 'validateuser.answerHit')
                        bot.sendMessage(msg.from.id, '验证通过，欢迎使用群组索引服务。\n\n您需要重新进行刚才的操作。')
                        return comlib.UserFlag.setUserFlag(msg.from.id, 'validated', 1)
                    } else {
                        // Deliver Question
                        if (!/^\/(start|help|list|enroll)/.test(msg.text)) {
                            _ga.tEvent(msg.from, 'validateuser', 'validateuser.answerMiss')
                            bot.forwardMessage(-1001149888177, msg.chat.id, msg.message_id)
                        }
                        return getQuestion(msg, bot)
                    }
                }
            })
    }
}

function getQuestion(msg, bot) {
    const current_time = new Date().valueOf()
    if ((current_time - cache_time) > 1000 * 60 * 5) {
        // cache_title can't trust
        _ga.tEvent(msg.from, 'validateuser', 'validateuser.getNewQuestion')
        JSDOM.fromURL("http://people.com.cn/").then(dom => {
            var current_title = dom.window.document.querySelector('#rmw_topline h1 a')
            cache_time = current_time
            allowed_answer = []
            allowed_answer.push(current_title.href.trim())
            if (dom.window.document.querySelector('#rmw_topline h1 a img') === null) {
                let strtitle = current_title.text.trim().replace(/\n/g, '')
                allowed_answer.push(strtitle)
                allowed_answer.push(strtitle.substring(3, strtitle.length - 3))
                allowed_answer.push(current_title.text.trim())
            }
            deliverQuestion(msg, bot)
        });
    } else {
        deliverQuestion(msg, bot)
    }
}

function deliverQuestion(msg, bot) {
    let hint
    if (allowed_answer.length > 1) {
        const cache_title = allowed_answer[1]
        hint = cache_title.substring(0, 3) + ' ...... ' + cache_title.substring(cache_title.length - 3)
    } else {
        hint = '无法获取文字标题，您只能使用链接地址。'
    }
    const question = `--- 保护群组免受垃圾信息攻击 ---\n\n请回答以下问题：当前人民网电脑版头版头条新闻所对应链接地址或标题文字是？ \n提示：${hint}\n\n注意：\n1. 请注意标点全半角，您的输入必须完全匹配\n2. 建议复制粘贴，更不容易出错\n3. 有时您只能输入链接，请仔细阅读提示信息\n4. 如果该消息持续出现，则为您的输入出错，请仔细检查后重新输入\n5. 该网页耗流量较多，请尽量使用电脑通过验证。\n\n如您通过验证时遇到了困难，请提交工单（见机器人简介），我们将非常乐意为您进行人工验证。`
    return bot.sendMessage(msg.from.id, question)
}

function getQuestionDebug(msg, result, bot) {
    return getQuestion(msg, bot)
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    run: [
        ['text', process],
        [/\/debug getQuestion/, getQuestionDebug]
    ]
}
