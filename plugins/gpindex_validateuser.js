const { JSDOM } = require("jsdom");

const langCodeAllowed = ['zh-CN', 'zh-Hans-CN', 'zh-TW', 'zh-Hans-JP', 'zh-Hans-US', 'zh-Hant-HK', 'en-HK', 'zh-HK', 'zh-Hant-TW', 'zh-Hant-US', 'zho', 'en-CN', 'zh-Hans-HK', 'en-HK', 'zh', 'zh-Hans-DE', 'zh-Hant-UK', "zh-Hans", "zh-Hant"]
const langCodeBanned = ['fa-IR']

var cache_time = 0
cache_title = ''
function process(msg, type, bot) {
    if (msg.chat.id > 0) {
        comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
            .then(ret => {
                if (!ret) {
                    if (langCodeAllowed.indexOf(msg.from.language_code) > -1) {
                        _ga.tEvent(msg.from, 'validateuser', 'validateuser.languageHit')
                        bot.sendMessage(msg.from.id, '自动验证通过，欢迎使用群组索引服务。')
                        return comlib.UserFlag.setUserFlag(msg.from.id, 'validated', 1)
                    } else if (langCodeBanned.indexOf(msg.from.language_code) > -1) {
                        _ga.tEvent(msg.from, 'validateuser', 'validateuser.languageBanned')
                        bot.sendMessage(msg.from.id, '抱歉，您无权使用此服务。')
                        return comlib.UserFlag.setUserFlag(msg.from.id, 'block', 1)
                    }
                    else if (msg.text.trim() == cache_title) {
                        _ga.tEvent(msg.from, 'validateuser', 'validateuser.answerHit')
                        bot.sendMessage(msg.from.id, '验证通过，欢迎使用群组索引服务。')
                        return comlib.UserFlag.setUserFlag(msg.from.id, 'validated', 1)
                    } else {
                        // Deliver Question
                        _ga.tEvent(msg.from, 'validateuser', 'validateuser.answerMiss')
                        bot.forwardMessage(-1001149888177, msg.chat.id, msg.message_id)
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
            var current_title = dom.window.document.querySelector('#rmw_topline > h1 > a').text
            cache_time = current_time
            cache_title = current_title
            deliverQuestion(msg, bot)
        });
    } else {
        deliverQuestion(msg, bot)
    }
}

function deliverQuestion(msg, bot) {
    const hint = cache_title[0] + cache_title[1] + ' ...... ' + cache_title[cache_title.length - 2] + cache_title[cache_title.length - 1]
    const question = `保护群组免受垃圾信息攻击\n\n请回答以下问题：当前人民网头版头条新闻标题是？（建议复制粘贴，注意全半角标点和空格）\n提示：${hint}\n\n流量用户请注意：人民网无手机优化版，耗流量较多，请谨慎访问。\n\n如您通过验证时遇到了困难，请加入支持群提交工单，我们将非常乐意为您进行人工验证。`
    bot.sendMessage(msg.from.id, question)
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
    },
    run: [
        ['text', process]
    ]
}
