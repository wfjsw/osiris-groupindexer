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
function setUserFlag(uid, flag, value) {
    return r.table('userdata').get(parseInt(uid)).run(db_conn)
    .then((ret) => {
        var upd = {};
        upd[flag] = value;
        if (ret) 
            return r.table('userdata').get(parseInt(uid)).update(upd).run(db_conn);
        else {
            upd['id'] = parseInt(uid);
            return r.table('userdata').insert(upd).run(db_conn);
        }
    })
}
function queryUserFlag(uid, flag) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('userdata').get(parseInt(uid)).default({}).pluck(flag).run(db_conn)
        .then((ret) => {
            if (!(ret[flag] === undefined)) {
                return ret[flag];
            } else {
                return false;
            }
        });
}
function removeUserFlag(uid, flag) {
    return r.table('userdata').get(parseInt(uid)).replace((user) => {
        return user.without(flag);
    });
}

// Group Extra Tag
function setGroupExTag(gid, flag, value) {
    return r.table('groups').get(parseInt(gid)).run(db_conn)
    .then((ret) => {
        var upd = {};
        upd[flag] = value;
        if (ret) 
            return r.table('groups').get(parseInt(gid)).update({extag: upd}).run(db_conn);
        else {
            throw 'GroupNotFound';
        }
    })
}
function queryGroupExTag(uid, flag) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('groups').get(parseInt(gid)).pluck('extag').run(db_conn)
        .then((ret) => {
            if (ret && ret['extag']) {
                return ret['extag'][flag];
            } else {
                return false;
            }
        });
}

function setLock(uid) {
    lock[uid] = true;
}

function unsetLock(uid) {
    lock[uid] = false;
    delete lock[uid];
}

function getLock(uid) {
    return lock[uid] ? true : false;
}

function getRecord(group) {
    if (!db_conn) throw 'databaseNotConnected';
        var gid = parseInt(group);
        return r.table('groups').get(gid).run(db_conn);
}

function getRecByTag(tag) {
if (!db_conn) throw 'databaseNotConnected';
    try {
        return r.table('groups').getAll(tag, {index: 'tag'}).run(db_conn)
        .then((cursor) => {
            return cursor.toArray()
        });
    } catch (e) {
        console.error(e);
        // report to admin group?
    }
}

function getRecByCreator(uid) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('groups').filter({creator: uid}).run(db_conn)
    .then((cursor) => {
        return cursor.toArray()
    });
}

function searchByName(term) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('groups').filter( (group) => {
        return group('title').match('(?i)'+term)
    }).run(db_conn)
    .then((cursor) => {
        return cursor.toArray()
    });
}

function doEnrollment(groupinfo) {
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

function doRemoval(group) {
    while (!db_conn) {
        // Block and wait
    }
    try {
        var gid = parseInt(group);
       return r.table('groups').get(gid).delete().run(db_conn);
    } catch (e) {
        console.error(e);
    }
}

function commitPublic() {
    if (queue.public.length > 0){
        var groupcursor = queue.public.shift();
        if (groupcursor.is_update) {
            delete groupcursor.is_update
            var _is_silent = groupcursor.is_silent
            delete groupcursor.is_silent
            return r.table('groups').get(parseInt(groupcursor.id)).update(groupcursor).run(db_conn)
            .then( (ret) => {
                if (!_is_silent) event.emit('update_public_data', groupcursor);
                return ret;
            });
        } else {
            return r.table('groups').insert(groupcursor).run(db_conn)
            .then( (ret) => {
                event.emit('new_public_commit', groupcursor);
                return ret;
            } );
        }
    } else {
        return false;
    }
}

function doValidate(gid, is_update, is_silent) {
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

function silentInsert(groupinfo) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('groups').insert(groupinfo).run(db_conn)
}

function silentUpdate(id, updation) {
    if (!db_conn) throw 'databaseNotConnected';
    return r.table('groups').get(parseInt(id)).update(updation).run(db_conn)
}

function init() {
    console.log(config);
	r.connect(config)
    .then((conn) => {
        db_conn = conn;
        conn.addListener('close', () => {
            // notify admin about connection close
            conn.reconnect();
        });
	    console.log('connected')
        setInterval(commitPublic, 1000);
    })
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
        removeUserFlag
    },
    GroupExTag: {
        setGroupExTag,
        queryGroupExTag
    }
}
