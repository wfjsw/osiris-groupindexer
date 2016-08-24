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

function getRecord(gid) {
    while (!db_conn) {
        // Block and wait
    }
    return r.table('groups').get(gid).run(db_conn);
}

function doEnrollment(groupinfo) {
    if (groupinfo.is_public) {
        queue.public.push(groupinfo);
        event.emit('new_public_queue', groupinfo);
        return 'new_public_queue';
    } else {
        queue.private[groupinfo.id] = groupinfo;
        event.emit('new_private_queue', groupinfo);
        return 'new_private_queue';
    }
}

function doRemoval(gid) {
    while (!db_conn) {
        // Block and wait
    }
    return r.table('groups').get(gid).delete().run(db_conn);
}

function commitPublic() {
    while (!db_conn) {
        // Block and wait
    }
    if (queue.public.length > 0){
        var groupcursor = queue.public.shift();
        if (groupcursor.is_update) {
            delete groupcursor.is_update;
            return r.table('groups').update(groupcursor).run(db_conn)
            .then( (ret) => {
                event.emit('update_public_data', groupcursor);
                return ret;
            } );
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
        return r.table('groups').update(groupcursor).run(db_conn)
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
	doValidate,
	doRemoval,
	commitPublic
}
