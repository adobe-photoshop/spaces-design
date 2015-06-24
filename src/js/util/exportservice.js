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

    var NodeDomain = require("generator-connection").NodeDomain,
        Promise = require("bluebird"),
        log = require("js/util/log");

    /**
     * The name of the domain to connect to, which corresponds to the name of the generator plugin
     * @const
     * @type {string}
     */
    var GENERATOR_DOMAIN_NAME = "generator-spaces";

    /**
     * The port on which the generator websocket server is started.
     * TODO - This will eventually be fetched from photoshop dynamically
     * @const
     * @type {number}
     */
    var GENERATOR_PORT = 59596;

    /**
     * Duration after which we should give up trying to connect to the export plugin
     * @const
     * @type {number}
     */
    var CONNECTION_TIMEOUT_MS = 2000;

    /**
     * Somehow, somewhere, get me that port
     *
     * @param {function} callback
     */
    var getRemotePort = function (callback) {
        callback(null, GENERATOR_PORT);
    };

    /**
     * @constructor
     */
    var ExportService = function () {
        this.spacesDomain = null;
    };

    /**
     * Creates the underlying connection to the generator plugin via a NodeDomain.  Resolves when connected.
     *
     * @return {Promise}
     */
    ExportService.prototype.init = function () {
        this.spacesDomain = new NodeDomain(GENERATOR_DOMAIN_NAME, getRemotePort);
        log.debug("Export Service initialized");
        return this.spacesDomain.promise().timeout(CONNECTION_TIMEOUT_MS);
    };

    /**
     * A simple test to see if this service is open for business
     *
     * @return {boolean}
     */
    ExportService.prototype.ready = function () {
        return this.spacesDomain && this.spacesDomain.ready();
    };

    /**
     * Explicitly disconnects the websocket connection
     *
     * @return {Promise}
     */
    ExportService.prototype.close = function () {
        if (this.spacesDomain && this.spacesDomain.ready()) {
            this.spacesDomain.connection.disconnect();
            return Promise.resolve();
        }
    };

    /**
     * Export a layer asset
     *
     * @param {Layer} layer
     * @param {ExportAsset} asset
     *
     * @return {string} File Path of the exported asset
     */
    ExportService.prototype.exportLayerAsset = function (layer, asset) {
        var payload = {
            layer: layer,
            scale: asset.scale,
            suffix: asset.suffix,
            format: asset.format
        };

        if (!this.spacesDomain) {
            throw new Error ("Can not exportLayerAsset prior to ExportService.init()");
        }

        return this.spacesDomain.exec("exportLayer", payload)
            .then(function (exportResponse) {
                if (Array.isArray(exportResponse) && exportResponse.length > 0) {
                    return exportResponse;
                } else {
                    log.error("Export failed for layer [%s], asset %s", layer.name, JSON.stringify(asset));
                    return Promise.reject("Export Failed");
                }
            });
    };

    module.exports = ExportService;
});
