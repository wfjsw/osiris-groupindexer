// Requires Quesbank

const he = require('he').encode
const libQuesbank = require('../lib/quesbank').quesBankUtil

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
    },
]
const buttons_per_line = 4 // *** 这个 4 调整每行按钮数 ***

var _e, comlib, _ga

var wrongcount = {}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processUserTest(msg, type, bot) {
    if (msg.chat.id > 0) return
    for (let user of msg.new_chat_members) {
        const uid = user.id
        const is_enabled = !!(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:ingroupvalidation'))
        if (!is_enabled) return

        const is_user_validated = !!(await comlib.UserFlag.queryUserFlag(uid, 'validated'))
        if (is_user_validated) {
            _ga.tEvent(user, 'ingroupvalidation', 'ingroupvalidation.noNeed')
            const noneedvalidate = await _e.bot.sendMessage(msg.chat.id, `用户 <a href="tg://user?id=${uid}">${he(user.first_name)}</a> 已经通过日人民报验证，无需重复验证。`, {
                parse_mode: 'HTML'
            })
            return setTimeout(() => {
                bot.deleteMessage(msg.chat.id, noneedvalidate.message_id)
                    .catch(() => { })
            }, 10 * 1000)
        } else {
            try {
                await sleep(1200)
                await bot.restrictChatMember(msg.chat.id, uid, {
                    can_send_messages: false
                })
                let this_bank_id = Math.floor(Math.random() * (banks.length - 1))
                let this_bank = banks[this_bank_id]
                let question = this_bank.bank.generateQuestion(this_bank.answer_per_session, this_bank.dummy_per_session)
                let row = [],
                    i = 0;
                let col = [];
                question.forEach((child, index) => {
                    col.push({
                        text: child.v,
                        callback_data: `igv:${this_bank_id}&${uid}&${child.k}&${index}`
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
                wrongcount[`${msg.chat.id}:${uid}`] = 0
                _ga.tEvent(user, 'ingroupvalidation', 'ingroupvalidation.presentChallenge')
                await bot.restrictChatMember(msg.chat.id, uid, {
                    can_send_messages: false
                })
                await bot.sendMessage(msg.chat.id, `您好 <a href="tg://user?id=${uid}">${he(user.first_name)}</a>，欢迎来到 ${msg.chat.title}，该群组启用了群内防清真验证，请回答以下问题：\n\n请从下列按钮中选取 ${this_bank.name}`, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: row
                    }
                })
            } catch (e) {
                console.error(e)
                _ga.tException(user, e, true)
                _ga.tEvent(user, 'ingroupvalidation', 'ingroupvalidation.initFailed')
                return await bot.sendMessage(msg.chat.id, '群内防清真验证功能激活失败，请确认管理员权限。')
            }
        }
    }
}

async function processAnswer(msg, type, bot) {
    let [operator, query] = msg.data.split(':')
    if (operator != 'igv') return
    let [last_bank_id, user, answer, index] = query.split('&')
    last_bank_id = parseInt(last_bank_id)
    user = parseInt(user)
    index = parseInt(index)
    if (isNaN(wrongcount[`${msg.message.chat.id}:${msg.from.id}`])) wrongcount[`${msg.message.chat.id}:${msg.from.id}`] = 0
    if (msg.from.id != user) {
        return await bot.answerCallbackQuery({
            callback_query_id: msg.id,
            text: '请勿代人答题。',
            show_alert: false
        })
    }
    // if (processing[`${msg.message.chat.id}:${msg.from.id}`]) return
    // processing[`${msg.message.chat.id}:${msg.from.id}`] = true
    let last_bank = banks[last_bank_id]
    const is_correct = last_bank.bank.validateAnswer(answer)
    if (is_correct) {
        _ga.tEvent(msg.from, 'ingroupvalidation', 'ingroupvalidation.responseCorrect')
        await bot.restrictChatMember(msg.message.chat.id, msg.from.id, {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true
        })
        wrongcount[`${msg.message.chat.id}:${msg.from.id}`] = 0
        delete wrongcount[`${msg.message.chat.id}:${msg.from.id}`]
        // processing[`${msg.message.chat.id}:${msg.from.id}`] = false
        // delete processing[`${msg.message.chat.id}:${msg.from.id}`]
        await bot.editMessageText(`<a href="tg://user?id=${msg.from.id}">${he(msg.from.first_name)}</a> 已通过验证。`, {
            chat_id: msg.message.chat.id,
            message_id: msg.message.message_id,
            parse_mode: 'HTML'
        })
        return await bot.answerCallbackQuery({
            callback_query_id: msg.id,
            text: '您已通过。',
            show_alert: false
        })
    } else /* if (wrongcount[`${msg.message.chat.id}:${msg.from.id}`] < 5) */ {
        try {
            await sleep(500)
            const this_err_count = ++wrongcount[`${msg.message.chat.id}:${msg.from.id}`]
            let this_bank_id = Math.floor(Math.random() * (banks.length - 1))
            let this_bank = banks[this_bank_id]
            let question = this_bank.bank.generateQuestion(this_bank.answer_per_session, this_bank.dummy_per_session, index)
            let row = []
            let col = []
            question.forEach((child, idx) => {
                col.push({
                    text: child.v,
                    callback_data: `igv:${this_bank_id}&${msg.from.id}&${child.k}&${idx}`
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
            _ga.tEvent(msg.from, 'ingroupvalidation', 'ingroupvalidation.responseWrong')
            await bot.editMessageText(`您好 <a href="tg://user?id=${msg.from.id}">${he(msg.from.first_name)}</a>，欢迎来到 ${msg.message.chat.title}，该群组启用了群内防清真验证，请回答以下问题：\n\n请从下列按钮中选取 ${this_bank.name}\n您已答错 ${this_err_count} 次`, {
                message_id: msg.message.message_id,
                chat_id: msg.message.chat.id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: row
                }
            })
            // processing[`${msg.message.chat.id}:${msg.from.id}`] = false
            // delete processing[`${msg.message.chat.id}:${msg.from.id}`]
            return await bot.answerCallbackQuery({
                callback_query_id: msg.id,
                text: '答案错误。',
                show_alert: true
            })
        } catch (e) {
            console.error(e.stack)
            _ga.tException(msg.from, e.message, true)
        }
    }
    /* else {
            if (locked[msg.from.id]) {
                locked[msg.from.id].push(msg.message.chat.id)
            } else {
                locked[msg.from.id] = []
                locked[msg.from.id].push(msg.message.chat.id)
            }
            return await bot.editMessageText(`您好 ${msg.from.first_name}，您已失败超过 5 次，请使用 日人民报 验证方式。`, {
                message_id: msg.message.message_id,
                chat_id: msg.message.chat.id,
                reply_markup: {
                    inline_keyboard: [[{
                        text: '前往验证',
                        url: `https://t.me/${_e.me.username}?start=validateuserchallenge`
                    }]]
                }
            })
        }*/
}

/*
async function testUser(msg, type, bot) {
    async function passThis(gid, uid) {
        await bot.sendMessage(gid, `该用户已通过 日人民报 验证。`)
        await bot.restrictChatMember(gid, uid, {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true
        })
    }
    await sleep(2000)
    if (!locked[msg.from.id]) return
    const is_validated = await comlib.UserFlag.queryUserFlag(msg.from.id, 'validated')
    if (!is_validated) return
    locked[msg.from.id].forEach(group => {
        passThis(group, msg.from.id)
    })
    delete locked[msg.from.id]
}
*/

module.exports = {
    init: (e) => {
        _e = e
        comlib = _e.libs['gpindex_common']
        _ga = e.libs['ga']
    },
    run: [
        ['new_chat_members', processUserTest],
        ['callback_query', processAnswer],
        //['text', testUser]
    ]
}
