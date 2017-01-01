'use strict';

const EventEmitter = require('events');
const r = require('rethinkdb')
const config = require('../config.json')['gpindex_db'];

const event = new EventEmitter();

var db_conn;
var queue = {
    public: [],
    private: {},
    private_update: {}
};
var lock = {};

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
//    while (!db_conn) {
        // Block and wait
//    }
    if (!db_conn) throw 'databaseNotConnected';
//    try {
        var gid = parseInt(group);
        return r.table('groups').get(gid).run(db_conn);
//    } catch (e) {
//        console.error(e);
//    }
}

function getRecByTag(tag) {
    while (!db_conn) {
        // Block and wait
    }
    try {
        return r.table('groups').filter({tag: tag}).run(db_conn)
        .then((cursor) => {
            return cursor.toArray()
        });
    } catch (e) {
        console.error(e);
        // report to admin group?
    }
}

function getRecByCreator(uid) {
//    while (!db_conn) {
        // Block and wait
//    }
//    try {
        return r.table('groups').filter({creator: uid}).run(db_conn)
        .then((cursor) => {
            return cursor.toArray()
        });
//    } catch (e) {
//        console.error(e);
//    }
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
    while (!db_conn) {
        // Block and wait
    }
    if (queue.public.length > 0){
        var groupcursor = queue.public.shift();
        if (groupcursor.is_update) {
            delete groupcursor.is_update;
            return r.table('groups').get(parseInt(groupcursor.id)).update(groupcursor).run(db_conn)
            .then( (ret) => {
                event.emit('update_public_data', groupcursor);
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

function doValidate(gid, is_update) {
    while (!db_conn) {
        // Block and wait
    }
    var groupcursor = is_update ? queue.private_update[gid] : queue.private[gid];
    if (is_update) {
        delete groupcursor.is_update;
        return r.table('groups').get(groupcursor.id).update(groupcursor).run(db_conn)
        .then((ret) => {
            event.emit('update_private_data', groupcursor);
            return ret;
        });
    } else {
        return r.table('groups').insert(groupcursor).run(db_conn)
        .then((ret) => {
            event.emit('new_private_commit', groupcursor);
            return ret;
        })
    }
}

function silentInsert(groupinfo) {
    while (!db_conn) {
        // Block and wait
    }
    return r.table('groups').insert(groupinfo).run(db_conn)
}

function silentUpdate(id, updation) {
    while (!db_conn) {
        // Block and wait
    }
    return r.table('groups').get(parseInt(id)).update(updation).run(db_conn)
}

function init() {
    console.log(config);
	r.connect(config)
    .then((conn) => {
        db_conn = conn;
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
	doValidate,
	doRemoval,
	commitPublic,
    silentInsert,
    silentUpdate,
    setLock,
    getLock,
    unsetLock
}
