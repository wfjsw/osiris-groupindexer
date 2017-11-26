const {
    JSDOM
} = require("jsdom")

async function checkInvite(url) {
    try {
        let page = await JSDOM.fromURL(url)
        let title = page.window.document.querySelector('.tgme_page_title').textContent.trim()
        if (title == 'Join group chat on Telegram') {
            return false
        } else {
            return title
        }
    } catch (e) {
        console.error(e.message)
        return false
    }
}

async function getMemberCount(url) {
    try {
        let page = await JSDOM.fromURL(url)
        let extra = page.window.document.querySelector('.tgme_page_extra')
        if (extra) {
            if (extra.textContent.trim().match(/[0-9 ]*[0-9]/)) {
                let count = parseInt(extra.textContent.trim().match(/[0-9 ]*[0-9]/)[0].replace(/\s/, ''))
                console.log('t.me getMemberCount: ', url + ' - ' + count)
                return count 
            }
            return false
        } else {
            return false
        }
    } catch (e) {
        console.error(e.message)
        return false
    }
}

module.exports = {
    checkInvite,
    getMemberCount
}
