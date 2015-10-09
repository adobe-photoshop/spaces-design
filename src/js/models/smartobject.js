/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

define(function (require, exports, module) {
    "use strict";

    var Immutable = require("immutable"),
        _ = require("lodash");

    /**
     * @private
     * @param {object} model
     */
    var Link = Immutable.Record({
        /**
         * @type {string}
         */
        _obj: null,

        /**
         * @type {string}
         */
        elementReference: null,

        /**
         * @type {string}
         */
        _path: null
    });

    /**
     * @constructor
     * @param {object} model
     */
    var SmartObject = Immutable.Record({
        /**
         * @type {string}
         */
        _obj: null,

        /**
         * @type {string}
         */
        fileReference: null,

        /**
         * @type {boolean}
         */
        linked: null,

        /**
         * @type {boolean}
         */
        linkMissing: false,

        /**
         * @type {boolean}
         */
        linkChanged: false,

        /**
         * @type {Link}
         */
        link: null
    });

    /**
     * Given a descriptor object from photoshop, build a new SmartObject
     *
     * @param {object} descriptor
     * @return {SmartObject}
     */
    SmartObject.fromDescriptor = function (descriptor) {
        var nextSmartObject = new SmartObject(_.omit(descriptor, "link"));

        if (descriptor.link) {
            return nextSmartObject.set("link", new Link(descriptor.link));
        } else {
            return nextSmartObject;
        }
    };

    module.exports = SmartObject;
});
