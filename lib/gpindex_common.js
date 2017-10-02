'use strict';

const EventEmitter = require('events');
const r = require('rethinkdb')
const config = require('../config.gpindex.json')['gpindex_db'];

const event = new EventEmitter();

var db_conn;
var queue = {
    public: [],
    private: {},
    private_update: {}
};
var lock = {};


// Flag User
async function setUserFlag(uid, flag, value) {
    let user = await r.table('userdata').get(parseInt(uid)).run(db_conn)
    if (user)
        return r.table('userdata').get(parseInt(uid)).update({
            [flag]: value
        }).run(db_conn);
    else {
        return r.table('userdata').insert({
            id: parseInt(uid),
            [flag]: value
        }).run(db_conn);
    }
}

async function queryUserFlag(uid, flag) {
    if (!db_conn) throw 'databaseNotConnected';
    let flag_obj = await r.table('userdata').get(parseInt(uid)).default({}).run(db_conn)
    return flag_obj[flag] || false
}

async function queryUserFlagAll(uid) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('userdata').get(parseInt(uid)).default({}).run(db_conn)
}

async function removeUserFlag(uid, flag) {
    return r.table('userdata').get(parseInt(uid)).replace((user) => {
        return user.without(flag);
    })
}

// Group Extra Tag
async function setGroupExTag(gid, flag, value) {
    let ret = await r.table('groupextag').get(parseInt(gid)).run(db_conn)
    if (ret)
        return r.table('groupextag').get(parseInt(gid)).update({
            [flag]: value
        }).run(db_conn);
    else {
        return r.table('groupextag').insert({
            id: parseInt(gid),
            [flag]: value
        }).run(db_conn)
    }
}

async function queryGroupExTag(gid, flag) {
    if (!db_conn) throw 'databaseNotConnected';
    let flag_obj = await r.table('groupextag').get(parseInt(gid)).default({}).run(db_conn)
    return flag_obj[flag] || false
}

async function queryGroupExTagAll(gid) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('groupextag').get(parseInt(gid)).default({}).run(db_conn)
}

function setLock(uid) {
    lock[uid] = true;
}

function unsetLock(uid) {
    lock[uid] = false;
    delete lock[uid];
}

function getLock(uid) {
    return !!lock[uid];
}

async function getRecord(group) {
    if (!db_conn) throw 'databaseNotConnected';
    var gid = parseInt(group);
    let result = await r.table('groups').get(gid).run(db_conn)
    if (result) result.extag = await queryGroupExTagAll(gid)
    return result
}

async function getRecByTag(tag) {
    if (!db_conn) throw 'databaseNotConnected';
    let results = await (await r.table('groups').getAll(tag, {
            index: 'tag'
    }).run(db_conn)).toArray()
    let results2 = []
    for (let result of results) {
        result.extag = await queryGroupExTagAll(result.id)
        results2.push(result)
    }
    return results2
}

async function getRecByCreator(uid) {
    if (!db_conn) throw 'databaseNotConnected';
    let results = await (await r.table('groups').filter({
            creator: uid
        }).run(db_conn)).toArray()
    let results2 = []
    for (let result of results) {
        result.extag = await queryGroupExTagAll(result.id)
        results2.push(result)
    }
    return results2
}

async function searchByName(term) {
    if (!db_conn) throw 'databaseNotConnected';
    let results = await (await r.table('groups').filter((group) => {
            return group('title').match('(?i)' + term)
        }).run(db_conn)).toArray()
    let results2 = []
    for (let result of results) {
        result.extag = await queryGroupExTagAll(result.id)
        results2.push(result)
    }
    return results2
}

async function doEnrollment(groupinfo) {
    if (groupinfo.is_public) {
        queue.public.push(groupinfo);
        event.emit('new_public_queue', groupinfo);
        return 'new_public_queue';
    } else {
        if (groupinfo.is_update) queue.private_update[groupinfo.id] = groupinfo;
        else queue.private[groupinfo.id] = groupinfo;
        event.emit('new_private_queue', groupinfo);
        return 'new_private_queue';
    }
}

async function doRemoval(group) {
    try {
        var gid = parseInt(group);
        return r.table('groups').get(gid).delete().run(db_conn);
    } catch (e) {
        console.error(e);
    }
}

async function commitPublic() {
    if (queue.public.length > 0) {
        var groupcursor = queue.public.shift();
        if (groupcursor.is_update) {
            delete groupcursor.is_update
            var _is_silent = groupcursor.is_silent
            delete groupcursor.is_silent
            return r.table('groups').get(parseInt(groupcursor.id)).update(groupcursor).run(db_conn)
                .then((ret) => {
                    if (!_is_silent) event.emit('update_public_data', groupcursor);
                    return ret;
                });
        } else {
            return r.table('groups').insert(groupcursor).run(db_conn)
                .then((ret) => {
                    event.emit('new_public_commit', groupcursor);
                    return ret;
                });
        }
    } else {
        return false;
    }
}

async function doValidate(gid, is_update, is_silent) {
    if (!db_conn) throw 'databaseNotConnected';
    var groupcursor = is_update ? queue.private_update[gid] : queue.private[gid];
    if (is_update) {
        delete groupcursor.is_update;
        return r.table('groups').get(groupcursor.id).update(groupcursor).run(db_conn)
            .then((ret) => {
                if (!is_silent) event.emit('update_private_data', groupcursor);
                return ret;
            });
    } else {
        return r.table('groups').insert(groupcursor).run(db_conn)
            .then((ret) => {
                if (!is_silent) event.emit('new_private_commit', groupcursor);
                return ret;
            })
    }
}

async function silentInsert(groupinfo) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('groups').insert(groupinfo).run(db_conn)
}

async function silentUpdate(id, updation) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('groups').get(parseInt(id)).update(updation).run(db_conn)
}

async function init() {
    console.log(config);
    try {
        const conn = await r.connect(config)
        db_conn = conn
        conn.addListener('close', () => {
            // notify admin about connection close
            console.error('Reconnecting DB.')
            conn.reconnect();
        });
        console.log('connected')
    } catch (e) {
        console.error('Unable to connect to DB.')
        process.exit(1)
    }
    setInterval(commitPublic, 1000)
    process.on('unhandledRejection', (reason, p) => {
        console.log('Unhandled Rejection \n', reason.stack);
        // application specific logging, throwing an error, or other logic here
    });
}

module.exports = {
    event,
    init,
    doEnrollment,
    getRecord,
    getRecByTag,
    getRecByCreator,
    searchByName,
    doValidate,
    doRemoval,
    commitPublic,
    silentInsert,
    silentUpdate,
    setLock,
    getLock,
    unsetLock,
    UserFlag: {
        setUserFlag,
        queryUserFlag,
        queryUserFlagAll,
        removeUserFlag
    },
    GroupExTag: {
        setGroupExTag,
        queryGroupExTag,
        queryGroupExTagAll
    }
}
