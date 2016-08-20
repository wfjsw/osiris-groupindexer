'use strict';

module.exports = {
    run: [
        [/^\/writemenu/, writeMenu],
        [/^\/addcategory (.*)$/, addCategory],
        [/^\/removeitem ([0-9-]{6,}$/, removeItem],
        [/^\/markinvaild ([0-9-]{6,})$/, markInvaild]
    ]
}