// Requires Quesbank

const bank_a = require('../resources/quesbank_shzyhxjzg.json')
const bank_a_name = '社会主义核心价值观'
const bank_b = require('../resources/quesbank_zbzyhxjzg.json')
const bank_b_name = '资本主义核心价值观'

var _e, comlib, _ga, quesbank_a, quesbank_b

var wrongcount = {}
var locked = {}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processUserTest(msg, type, bot) {
    if (msg.chat.id > 0) return
    const user = msg.new_chat_member
    const uid = user.id
    const is_enabled = !!(await comlib.GroupExTag.queryGroupExTag(msg.chat.id, 'feature:ingroupvalidation'))
    if (!is_enabled) return

    const is_user_validated = !!(await comlib.UserFlag.queryUserFlag(uid, 'validated'))
    if (is_user_validated) {
        _ga.tEvent(msg.from, 'ingroupvalidation', 'ingroupvalidation.noNeed')
        const noneedvalidate = await _e.bot.sendMessage(msg.chat.id, `用户 ${msg.from.first_name} 已经通过日人民报验证，无需重复验证。`)
        return setTimeout(() => {
            bot.deleteMessage(msg.chat.id, noneedvalidate.message_id)
                .catch(() => {})
        }, 10 * 1000)
    } else {
        try {
            await sleep(1200)
            await bot.restrictChatMember(msg.chat.id, uid, {
                can_send_messages: false
            })
            let question = quesbank_a.generateQuestion(1, 15)
            let row = [],
                i = 0;
            let col = [];
            question.forEach((child, index) => {
                col.push({
                    text: child,
                    callback_data: `igv:${uid}&${child}&${index}`
                })
                if (col.length == 4) {
                    row.push(col);
                    col = [];
                }
            })
            if (col.length > 0) {
                row.push(col);
                col = [];
            }
            wrongcount[`${msg.chat.id}:${uid}`] = 0
            _ga.tEvent(msg.from, 'ingroupvalidation', 'ingroupvalidation.presentChallenge')
            await bot.restrictChatMember(msg.chat.id, uid, {
                can_send_messages: false
            })
            await bot.sendMessage(msg.chat.id, `您好 ${msg.from.first_name}，欢迎来到 ${msg.chat.title}，该群组启用了群内防清真验证，请回答以下问题：\n\n请从下列按钮中选取 ${bank_a_name}`, {
                reply_markup: {
                    inline_keyboard: row
                }
            })
        } catch (e) {
            console.error(e)
            _ga.tException(msg.from, e, true)
            _ga.tEvent(msg.from, 'ingroupvalidation', 'ingroupvalidation.initFailed')
            return await bot.sendMessage(msg.chat.id, '群内防清真验证功能激活失败，请确认管理员权限。')
        }
    }
}

async function processAnswer(msg, type, bot) {
    let [operator, query] = msg.data.split(':')
    if (operator != 'igv') return
    let [user, answer, index] = query.split('&')
    user = parseInt(user)
    index = parseInt(index)
    if (isNaN(wrongcount[`${msg.message.chat.id}:${msg.from.id}`])) wrongcount[`${msg.message.chat.id}:${msg.from.id}`] = 0
    if (msg.from.id != user) {
        return await bot.answerCallbackQuery(msg.id, '请勿代人答题。', false)
    }
    // if (processing[`${msg.message.chat.id}:${msg.from.id}`]) return
    // processing[`${msg.message.chat.id}:${msg.from.id}`] = true
    const is_correct = quesbank_a.validateAnswer(answer) || quesbank_b.validateAnswer(answer)
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
        await bot.editMessageText(`${msg.from.first_name} 已通过验证。`, {
            chat_id: msg.message.chat.id,
            message_id: msg.message.message_id,
        })
        return await bot.answerCallbackQuery(msg.id, '您已通过。', false)
    } else if (wrongcount[`${msg.message.chat.id}:${msg.from.id}`] < 5) {
        try {
            await sleep(500)
            const this_err_count = ++wrongcount[`${msg.message.chat.id}:${msg.from.id}`]
            let quesbank, qbname
            if (wrongcount[`${msg.message.chat.id}:${msg.from.id}`] < 3) {
                quesbank = quesbank_a
                qbname = bank_a_name
            } else {
                quesbank = quesbank_b
                qbname = bank_b_name
            }
            let question = quesbank.generateQuestion(1, 15, index)
            let row = []
            let col = []
            question.forEach((child, idx) => {
                col.push({
                    text: child,
                    callback_data: `igv:${msg.from.id}&${child}&${idx}`
                })
                if (col.length == 4) {
                    row.push(col);
                    col = [];
                }
            })
            if (col.length > 0) {
                row.push(col);
                col = [];
            }
            _ga.tEvent(msg.from, 'ingroupvalidation', 'ingroupvalidation.responseWrong')
            await bot.editMessageText(`您好 ${msg.from.first_name}，欢迎来到 ${msg.message.chat.title}，该群组启用了群内防清真验证，请回答以下问题：\n\n请从下列按钮中选取 ${qbname}\n您已答错 ${this_err_count} 次`, {
                message_id: msg.message.message_id,
                chat_id: msg.message.chat.id,
                reply_markup: {
                    inline_keyboard: row
                }
            })
            // processing[`${msg.message.chat.id}:${msg.from.id}`] = false
            // delete processing[`${msg.message.chat.id}:${msg.from.id}`]
            return await bot.answerCallbackQuery(msg.id, '答案错误。', true)
        } catch (e) {
            console.error(e)
            _ga.tException(msg.from, e, true)
        }
    } else {
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
    }
}

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

module.exports = {
    init: (e) => {
        _e = e
        comlib = _e.libs['gpindex_common']
        _ga = e.libs['ga']
        quesbank_a = new e.libs['quesbank'].quesBankUtil(bank_a)
        quesbank_b = new e.libs['quesbank'].quesBankUtil(bank_b)
    },
    run: [
        ['new_chat_member', processUserTest],
        ['callback_query', processAnswer],
        ['text', testUser]
    ]
}
