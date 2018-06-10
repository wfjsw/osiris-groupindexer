const EventEmitter = require('events');
const r = require('rethinkdb')
const Segment = require('segment')
const config = require('../config.gpindex.json')['gpindex_db']

const event = new EventEmitter();
const segment = new Segment()

var db_conn
var queue = {
    public: [],
    private: {},
    private_update: {}
};
var lock = {}

const sortFunc = {
    count_asc: 'member_count',
    count_desc: r.desc('member_count'),
    id_asc: 'id',
    id_desc: r.desc('id'),
    title_asc: 'title',
    title_desc: r.desc('title')
}

function truncateSearch(term) {
    return term.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')
}

// Flag User
async function setUserFlag(uid, flag, value) {
    if (!db_conn) throw new Error('databaseNotConnected');
    let user = await r.table('userdata').get(parseInt(uid)).run(db_conn)
    let updation = {}
    if (Array.isArray(flag) && Array.isArray(value)) {
        for (let i of flag) {
            updation[i] = value[flag.indexOf(i)]
        }
    } else {
        updation[flag] = value
    }
    if (user)
        return r.table('userdata').get(parseInt(uid)).update(updation).run(db_conn);
    else {
        updation.id = parseInt(uid)
        return r.table('userdata').insert(updation).run(db_conn);
    }
}

async function queryUserFlag(uid, flag) {
    if (!db_conn) throw new Error('databaseNotConnected');
    let result
    if (Array.isArray(flag)) {
        let flag_obj = await r.table('userdata').get(parseInt(uid)).default({}).run(db_conn)
        result = []
        for (let i of flag) {
            result[flag.indexOf(i)] = flag_obj[i]
        }
        return result
    } else {
        let flag_obj = await r.table('userdata').get(parseInt(uid)).default({}).run(db_conn)
        return flag_obj[flag] || false
    }
}

async function queryUserFlagAll(uid) {
    if (!db_conn) throw new Error('databaseNotConnected');
    return r.table('userdata').get(parseInt(uid)).default({}).without('id').run(db_conn)
}

async function removeUserFlag(uid, flag) {
    let updation = {}
    if (Array.isArray(flag)) {
        for (let i of flag) {
            updation[i] = r.literal()
        }
    } else {
        updation[flag] = r.literal()
    }
    return r.table('userdata').get(parseInt(uid)).update(updation)
}

// Group Extra Tag
async function setGroupExTag(gid, flag, value) {
    if (!db_conn) throw new Error('databaseNotConnected');
    let group = await r.table('groupextag').get(parseInt(gid)).run(db_conn)
    let updation = {}
    if (Array.isArray(flag) && Array.isArray(value)) {
        for (let i of flag) {
            updation[i] = value[flag.indexOf(i)]
        }
    } else {
        updation[flag] = value
    }
    if (group)
        return r.table('groupextag').get(parseInt(gid)).update(updation).run(db_conn);
    else {
        updation.id = parseInt(gid)
        return r.table('groupextag').insert(updation).run(db_conn);
    }
}

async function queryGroupExTag(gid, flag) {
    if (!db_conn) throw new Error('databaseNotConnected');
    let result
    if (Array.isArray(flag)) {
        let flag_obj = await r.table('groupextag').get(parseInt(gid)).default({}).run(db_conn)
        result = []
        for (let i of flag) {
            result[flag.indexOf(i)] = flag_obj[i]
        }
        return result
    } else {
        let flag_obj = await r.table('groupextag').get(parseInt(gid)).default({}).run(db_conn)
        return flag_obj[flag] || false
    }
}

async function queryGroupExTagAll(gid) {
    if (!db_conn) throw new Error('databaseNotConnected');
    return r.table('groupextag').get(parseInt(gid)).default({}).without('id').run(db_conn)
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
    if (!db_conn) throw new Error('databaseNotConnected');
    var gid = parseInt(group);
    let result = await r.table('groups').get(gid).default({}).merge(function (g) {
        return {
            "extag": r.table('groupextag').get(g('id')).default({}).without('id')
        }
    }).run(db_conn)
    return result.id ? result : false
}

async function getRecByTag(tag, offset, length, sortfunc) {
    if (!db_conn) throw new Error('databaseNotConnected');
    let req = r.table('groups')
    req = req.getAll(tag, {
        index: 'tag'
    }).default([]).merge(function (g) {
        return {
            "extag": r.table('groupextag').get(g('id')).default({}).without('id')
        }
    })
    if (sortfunc) {
        req = req.orderBy(sortFunc[sortfunc])
    }
    if ((offset !== null || offset !== undefined) && length) {
        req = req.slice(offset, offset + length)
    }
    let results = await (await req.run(db_conn)).toArray()
    return results
}

async function getRecByCreator(uid) {
    if (!db_conn) throw new Error('databaseNotConnected');
    let results = await (await r.table('groups').filter({
        creator: uid
    }).default([]).merge(function (g) {
        return {
            "extag": r.table('groupextag').get(g('id')).default({}).without('id')
        }
    }).run(db_conn)).toArray()
    return results
}

async function searchByName(term, offset, length, sortfunc, noautosplit, notruncate) {
    if (!db_conn) throw new Error('databaseNotConnected');
    let search
    if (!Array.isArray(term)) {
        if (!noautosplit) {
            search = segment.doSegment(term, {
                simple: true
            })
        } else {
            search = term.split(/[\s,]/)
        }
    } else {
        search = term
    }
    search = search.map(a => a.normalize())
    if (!notruncate) search = search.map(truncateSearch)
    let req = r.table('groups')
    for (let i of search) {
        req = req.filter(function (g) {
            return g('title').add(g('desc')).match('(?i)' + i)
        })
    }
    req = req.default([]).merge(function (g) {
        return {
            "extag": r.table('groupextag').get(g('id')).default({}).without('id')
        }
    })
    if (sortfunc) {
        req = req.orderBy(sortFunc[sortfunc])
    }
    if ((offset !== null || offset !== undefined) && length) {
        req = req.slice(offset, offset + length)
    }
    let results = await (await req.run(db_conn)).toArray()
    return results
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
        var gid = parseInt(group)
        event.emit('removed', {id: gid})
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
    if (!db_conn) throw new Error('databaseNotConnected');
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
    if (!db_conn) throw new Error('databaseNotConnected');
    return r.table('groups').insert(groupinfo).run(db_conn)
}

async function silentUpdate(id, updation) {
    if (!db_conn) throw new Error('databaseNotConnected');
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
        segment.useDefault()
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
