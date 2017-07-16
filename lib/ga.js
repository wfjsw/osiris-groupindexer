'use strict'

const UUID = require('uuid-1345');
const requestpromise = require('request-promise-native')
const tid = require('../config.ga.json')['tid']

const rp = requestpromise.defaults({
    url: 'https://www.google-analytics.com/collect',
    method: 'POST',
    form: {
        v:1,
        tid
    }
})

function tEvent(user, cat, action, label, value) {
    console.log(`Reporting Event ${user.id} ${cat} ${action} ${label}`)
    var options = {
        form: {
            cid: UUID.v5({namespace: '91461c99-f89d-49d2-af96-d8e2e14e9b58', name: user.id.toString()}),
            uid: user.id,
            t: 'event',
            ec: cat,
            ea: action,
            el: label,
            ev: value,
            ul: user.language_code
        }
    }
    if (label) options.form.el = label
    if (value) options.form.ev = value
    return rp(options)
}

function tException(cid, description, fatal) {
    console.log(`Reporting Incident ${cid} ${description} ${fatal}`)
    var options = {
        form: {
            cid,
            t: 'exception',
            exd: description,
            exf: fatal ? 1 : 0
        }
    }
    return rp(options)
}

module.exports = exports = {
    tEvent,
    tException
}