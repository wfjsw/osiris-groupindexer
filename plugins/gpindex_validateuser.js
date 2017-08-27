const {
    JSDOM
} = require("jsdom");
const libQuesbank = require('../lib/quesbank').quesBankUtil

const ADMIN_GROUP = require('../config.gpindex.json')['gpindex_admin'];

const langCodeAllowed = ['zh-CN', 'zh-Hans-CN', 'zh-TW', 'zh-Hans-JP',
    'zh-Hans-US', 'zh-Hant-HK', 'en-HK', 'zh-HK', 'zh-Hant-TW',
    'zh-Hant-US', 'zho', 'en-CN', 'zh-Hans-HK', 'en-HK', 'zh',
    'zh-Hans-DE', 'zh-Hant-UK', "zh-Hans", "zh-Hant", 'zh-Hans-GB',
    'zh@collation=pinyin', 'zh-Hans-NL', 'zh-Hans-CA', 'zh-Hant-CN',
    'zh-Hans-AU', 'zh-Hans-BM', 'zh-Hans-GB', 'zh-Hans-NL', 'zh-Hans-ZA',
    'zh-Hant-MO'
]
const langCodeBanned = ['fa-IR']

const banks = [{
        name: '社会主义核心价值观',
        bank: new libQuesbank(require('../resources/quesbank_shzyhxjzg.json')),
        answer_per_session: 1, // 每次提供 1 个真答案
        dummy_per_session: 15 // 每次提供 15 个假答案
    },
    {
        name: '资本主义核心价值观',
        bank: new libQuesbank(require('../resources/quesbank_zbzyhxjzg.json')),
        answer_per_session: 1,
        dummy_per_session: 15
    }
]
const buttons_per_line = 4 // *** 这个 4 调整每行按钮数 ***
const uvf_max_tries = 5
var wrongcount = {}

var _e, comlib, _ga
var cache_time = 0
var allowed_answer = []

　
function CtoH(str) {　　
    let result = ""
    for (var i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) == 12288) {
            result += String.fromCharCode(str.charCodeAt(i) - 12256)
            continue
        }
        if (str.charCodeAt(i) == 12290) {
            result += String.fromCharCode(46)
            continue
        }
        if (str.charCodeAt(i) == 8220 || str.charCodeAt(i) == 8221) {
            result += String.fromCharCode(34)
            continue
        }
        if (str.charCodeAt(i) == 8216 || str.charCodeAt(i) == 8217) {
            result += String.fromCharCode(39)
            continue
        }
        if (str.charCodeAt(i) > 65280 && str.charCodeAt(i) < 65375)
            result += String.fromCharCode(str.charCodeAt(i) - 65248)
        else result += str[i]　　
    }　　
    return result　
}

async function firstStageFirstDisplay(msg, bot) {
    let this_bank_id = Math.floor(Math.random() * banks.length)
    let this_bank = banks[this_bank_id]
    let question = this_bank.bank.generateQuestion(this_bank.answer_per_session, this_bank.dummy_per_session)
    let row = []
    let col = [];
    question.forEach((child, index) => {
        col.push({
            text: child.v,
            callback_data: `vuf:${this_bank_id}&${msg.from.id}&${child.k}&${index}`
        })
        if (col.length == buttons_per_line) {
            row.push(col);
            col = [];
        }
    })
    if (col.length > 0) {
        row.push(col);
        col = [];
    }
    wrongcount[msg.from.id] = 0
    await bot.sendMessage(msg.chat.id, `--- 保护群组免受垃圾信息攻击 ---\n\n请回答以下问题：\n请从下列按钮中选取 ${this_bank.name}`, {
        reply_markup: {
            inline_keyboard: row
        }
    })
    _ga.tEvent(msg.from, 'validateuser', 'validateuser.uvfFirstPresent')
}

async function firstStageProcessAnswer(msg, bot, query) {
    if ((wrongcount[msg.from.id] || 0) >= uvf_max_tries) {
        _ga.tEvent(msg.from, 'validateuser', 'validateuser.uvfFailed')
        await bot.editMessageText(`--- 保护群组免受垃圾信息攻击 ---\n\n答案错误。您的快速测试机会已用尽。`, {
            message_id: msg.message.message_id,
            chat_id: msg.message.chat.id,
        })
        getQuestion(msg, bot)
        return await bot.answerCallbackQuery({
            callback_query_id: msg.id,
            text: '答案错误。您的快速测试机会已用尽。',
            show_alert: true
        })
    }
    let [last_bank_id, user, answer, index] = query.split('&')
    last_bank_id = parseInt(last_bank_id)
    user = parseInt(user)
    index = parseInt(index)
    if (isNaN(wrongcount[msg.from.id])) wrongcount[msg.from.id] = 0
    if (msg.from.id != user) return
    let last_bank = banks[last_bank_id]
    const is_correct = last_bank.bank.validateAnswer(answer)
    if (is_correct) {
        wrongcount[msg.from.id] = 0
        delete wrongcount[msg.from.id]
        await bot.editMessageText(`验证通过，欢迎使用群组索引服务。\n\n您需要重新进行刚才的操作。`, {
            chat_id: msg.message.chat.id,
            message_id: msg.message.message_id,
        })
        await bot.answerCallbackQuery({
            callback_query_id: msg.id,
            text: '您已通过。',
            show_alert: false
        })
        _ga.tEvent(msg.from, 'validateuser', 'validateuser.uvfPass')
        return comlib.UserFlag.setUserFlag(msg.from.id, 'validated', 1)
    } else if (wrongcount[msg.from.id] < uvf_max_tries) {
        try {
            const this_err_count = ++wrongcount[msg.from.id]
            let this_bank_id = Math.floor(Math.random() * (banks.length - 1))
            let this_bank = banks[this_bank_id]
            let question = this_bank.bank.generateQuestion(this_bank.answer_per_session, this_bank.dummy_per_session, index)
            let row = []
            let col = []
            question.forEach((child, idx) => {
                col.push({
                    text: child.v,
                    callback_data: `vuf:${this_bank_id}&${msg.from.id}&${child.k}&${idx}`
                })
                if (col.length == buttons_per_line) {
                    row.push(col);
                    col = [];
                }
            })
            if (col.length > 0) {
                row.push(col);
                col = [];
            }
            _ga.tEvent(msg.from, 'validateuser', 'validateuser.uvfWrong')
            await bot.editMessageText(`--- 保护群组免受垃圾信息攻击 ---\n\n请回答以下问题：\n请从下列按钮中选取 ${this_bank.name}\n您已答错 ${this_err_count} 次，您的快速测试机会还剩余 ${uvf_max_tries - this_err_count} 次。`, {
                message_id: msg.message.message_id,
                chat_id: msg.message.chat.id,
                reply_markup: {
                    inline_keyboard: row
                }
            })
            return await bot.answerCallbackQuery({
                callback_query_id: msg.id,
                text: '答案错误。',
                show_alert: false
            })
        } catch (e) {
            console.error(e.stack)
            _ga.tException(msg.from, e.message, true)
        }
    } else {
        _ga.tEvent(msg.from, 'validateuser', 'validateuser.uvfFailed')
        await bot.editMessageText(`--- 保护群组免受垃圾信息攻击 ---\n\n答案错误。您的快速测试机会已用尽。`, {
            message_id: msg.message.message_id,
            chat_id: msg.message.chat.id,
        })
        getQuestion(msg, bot)
        return await bot.answerCallbackQuery({
            callback_query_id: msg.id,
            text: '答案错误。您的快速测试机会已用尽。',
            show_alert: true
        })
    }
}

function process(msg, type, bot) {
    if (msg.chat.id > 0) {
        comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
            .then(ret => {
                if (!ret) {
                    if (langCodeAllowed.indexOf(msg.from.language_code) > -1 && !wrongcount[msg.from.id]) {
                        // _ga.tEvent(msg.from, 'validateuser', 'validateuser.languageHit')
                        // bot.sendMessage(msg.from.id, '自动验证通过，欢迎使用群组索引服务。\n\n您需要重新进行刚才的操作。')
                        // return comlib.UserFlag.setUserFlag(msg.from.id, 'validated', 1)
                        return firstStageFirstDisplay(msg, bot)
                    } else if (langCodeAllowed.indexOf(msg.from.language_code) > -1 && wrongcount[msg.from.id] < uvf_max_tries) {
                        return bot.sendMessage(msg.from.id, '请向上翻页寻找快速测试问题。如果您已将快速测试问题删除，请提交工单为您人工通过。')
                    } else if (langCodeBanned.indexOf(msg.from.language_code) > -1) {
                        _ga.tEvent(msg.from, 'validateuser', 'validateuser.languageBanned')
                        bot.forwardMessage(-1001149888177, msg.chat.id, msg.message_id)
                        bot.sendMessage(ADMIN_GROUP, `${msg.from.language_code} user: ${msg.from.id}`)
                        bot.sendMessage(msg.from.id, '抱歉，您无权使用此服务。')
                        return comlib.UserFlag.setUserFlag(msg.from.id, 'block', 1)
                    } else if (allowed_answer.indexOf(CtoH(msg.text)
                            .replace(/people\.cn/, 'people.com.cn')
                            .replace(/^(http|https):\/\//, '')
                            .trim()) > -1) {
                        _ga.tEvent(msg.from, 'validateuser', 'validateuser.answerHit')
                        wrongcount[msg.from.id] = 0
                        delete wrongcount[msg.from.id]
                        bot.sendMessage(msg.from.id, '验证通过，欢迎使用群组索引服务。\n\n您需要重新进行刚才的操作。')
                        return comlib.UserFlag.setUserFlag(msg.from.id, 'validated', 1)
                    } else {
                        // Deliver Question
                        if (!/^\/(start|help|list|enroll)/.test(msg.text)) {
                            _ga.tEvent(msg.from, 'validateuser', 'validateuser.answerMiss')
                            bot.forwardMessage(-1001149888177, msg.chat.id, msg.message_id)
                        }
                        if (msg.text.match(/http:\/\/paper.people.com.cn\/rmrb\//)) {
                            return bot.sendMessage(msg.from.id, '请使用 people.com.cn 而不是 paper.people.com.cn 。')
                        }
                        if (msg.text.match(/http:\/\/m.people.cn\/rmrb\//)) {
                            return bot.sendMessage(msg.from.id, '请使用 people.com.cn 而不是 n.people.cn 。')
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
        bot.sendChatAction(msg.chat.id || msg.from.id, 'typing')
        JSDOM.fromURL("http://people.com.cn/").then(dom => {
            var current_title = dom.window.document.querySelector('#rmw_topline h1 a')
            cache_time = current_time
            allowed_answer = []
            allowed_answer.push(current_title.href.replace(/^(http|https):\/\//, '').trim())
            if (dom.window.document.querySelector('#rmw_topline h1 a img') === null) {
                let strtitle = CtoH(current_title.text.trim().replace(/\n/g, ''))
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
        hint = '***请粘贴标题所对应网址链接***'
    }
    const question = `--- 保护群组免受垃圾信息攻击 ---\n\n请回答以下问题：当前人民网电脑版头版头条新闻所对应链接地址或标题文字是？ \n提示：${hint}\n\n注意：\n1. 建议复制粘贴，更不容易出错\n2. 有时您只能输入链接，请仔细阅读提示信息\n3. 如果该消息持续出现，则为您的输入出错，请仔细检查后重新输入\n4. 系统所用于比对的网站是日人民网电脑版官网。其他来源将无法通过验证。\n5. 一切问题与答案均以首页为准。\n\n如您通过验证时遇到了困难，请提交工单（见机器人简介），我们将非常乐意为您进行人工验证。`
    return bot.sendMessage(msg.from.id, question)
}

function getQuestionDebug(msg, result, bot) {
    return getQuestion(msg, bot)
}

async function processCallbackQuery(msg, type, bot) {
    let [operator, query] = msg.data.split(':')
    if (operator == 'vuf')
        firstStageProcessAnswer(msg, bot, query)
}

module.exports = {
    init: (e) => {
        _e = e;
        comlib = _e.libs['gpindex_common'];
        _ga = e.libs['ga'];
        // populate answer cache
        JSDOM.fromURL("http://people.com.cn/").then(dom => {
            var current_title = dom.window.document.querySelector('#rmw_topline h1 a')
            cache_time = new Date().valueOf()
            allowed_answer = []
            allowed_answer.push(current_title.href.replace(/^(http|https):\/\//, '').trim())
            if (dom.window.document.querySelector('#rmw_topline h1 a img') === null) {
                let strtitle = CtoH(current_title.text.trim().replace(/\n/g, ''))
                allowed_answer.push(strtitle)
                allowed_answer.push(strtitle.substring(3, strtitle.length - 3))
                allowed_answer.push(current_title.text.trim())
            }
        });
    },
    run: [
        ['text', process],
        [/\/debug getQuestion/, getQuestionDebug],
        ['callback_query', processCallbackQuery]
    ]
}
