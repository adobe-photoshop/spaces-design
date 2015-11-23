/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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
/* global __PG_DEBUG__ */
define(function (require, exports) {
    "use strict";

    /**
     * Indicates whether the application is running in debug mode.
     * __PG_DEBUG__ is defined through webpack
     * 
     * @const
     * @type {boolean} 
     */
    var DEBUG = !!__PG_DEBUG__;

    /**
     * Namespace used for photoshop extension data
     * 
     * @const
     * @type {string} 
     */
    var EXTENSION_DATA_NAMESPACE = "designSpace";

    exports.debug = DEBUG;
    exports.EXTENSION_DATA_NAMESPACE = EXTENSION_DATA_NAMESPACE;
});
