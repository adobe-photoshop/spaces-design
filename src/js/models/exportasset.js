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
        objUtil = require("js/util/object");

    /**
     * Possible statuses of exports asset in the state machine
     *
     * @enum {string}
     */
    var STATUS = {
        NEW: "new",
        REQUESTED: "requested",
        STABLE: "stable",
        ERROR: "error"
    };

    /**
     * Supported formats of export assets
     *
     * @type {Imutable.List.<string>}
     */
    var FORMATS = Immutable.List(["png", "jpg", "svg", "pdf"]);

    /**
     * Supported scales of export assets
     *
     * @type {Imutable.List.<number>}
     */
    var SCALES = Immutable.List([1, 2, 3, 4, 5, 0.5, 0.75, 1.5]);

    /**
     * @constructor
     * @param {object} model
     */
    var ExportAsset = Immutable.Record({
        /**
         * @type {number}
         */
        scale: 1,

        /**
         * @type {string}
         */
        suffix: "@1x",

        /**
         * @type {string}
         */
        format: "png",

        /**
         * The status of this asset in the state machine
         * @type {string}
         */
        status: STATUS.NEW,

        /**
         * @type {string}
         */
        filePath: null

    });

    /**
     * Merge in a set of properties, and additionally
     * derive a new suffix IF the scale is changing AND the suffix was not previously customized
     *
     * @param {object} props ExportAsset-like properties
     * @return {ExportAsset}
     */
    ExportAsset.prototype.mergeProps = function (props) {
        if (!this.suffixCustomized && props.scale && (props.scale !== this.scale)) {
            return this.merge(props).deriveSuffix();
        } else {
            return this.merge(props);
        }
    };

    /**
     * Set the status to the "requested" status
     * @return {ExportAsset}
     */
    ExportAsset.prototype.setStatusRequested = function () {
        return this.set("status", STATUS.REQUESTED);
    };

    /**
     * Set the status to the "stable" status
     * @return {ExportAsset}
     */
    ExportAsset.prototype.setStatusStable = function () {
        return this.set("status", STATUS.STABLE);
    };

    Object.defineProperties(ExportAsset.prototype, objUtil.cachedGetSpecs({
        /**
         * Derive a standardized suffix based on the scale
         * @private
         * @type {string}
         */
        derivedSuffix: function () {
            return "@" + this.scale + "x";
        },

        /**
         * Determine if the suffix has been customized (not equal to the derived suffix)
         * @private
         * @type {boolean}
         */
        suffixCustomized: function () {
            return this.suffix !== this.derivedSuffix;
        }
    }));

    /**
     * Update this record with the derived suffix
     *
     * @return {ExportAsset}
     */
    ExportAsset.prototype.deriveSuffix = function () {
        return this.set("suffix", this.derivedSuffix);
    };

    /**
     * Attach some enums to the export
     */
    ExportAsset.STATUS = STATUS;
    ExportAsset.FORMATS = FORMATS;
    ExportAsset.SCALES = SCALES;
    
    module.exports = ExportAsset;
});
