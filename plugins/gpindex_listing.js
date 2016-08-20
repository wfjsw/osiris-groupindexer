'use strict';

module.exports = {
    run: [
        [/\/start getdetail@([0-9-]{6,})/, getDetail],
        [/\/getdetail ([0-9-]{6,})/, getDetail]
    ]
}