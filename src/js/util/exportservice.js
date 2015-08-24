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

    var GeneratorConnection = require("generator-connection"),
        NodeDomain = GeneratorConnection.NodeDomain,
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
    var GENERATOR_DEFAULT_PORT = 59596;

    /**
     * Duration after which we should give up trying to connect to the export plugin
     * @const
     * @type {number}
     */
    var CONNECTION_TIMEOUT_MS = 9000;

    /**
     * Maximum number of retry attempts
     * @const
     * @type {number}
     */
    var CONNECTION_MAX_ATTEMPTS = 30;

    /**
     * @constructor
     *
     * @param {number=} port Optional port on which to connect
     * @param {boolean=} quickCheck If truthy, perform an abbreviated attempt establish a connection
     */
    var ExportService = function (port, quickCheck) {
        var maxConnectionAttempts = quickCheck ? (CONNECTION_MAX_ATTEMPTS / 10) : CONNECTION_MAX_ATTEMPTS,
            getRemotePort = function (callback) {
                callback(null, port || GENERATOR_DEFAULT_PORT);
            };

        this._spacesDomain = new NodeDomain(GENERATOR_DOMAIN_NAME, getRemotePort, null, maxConnectionAttempts);
    };

    /**
     * The internal instance of the NodeDomain connection to the generator-spaces plugin
     * @private
     * @type {NodeDomain}
     */
    ExportService.prototype._spacesDomain = null;

    /**
     * Returns the NodeDomain's promise, including a timeout
     *
     * @return {Promise}
     */
    ExportService.prototype.init = function () {
        return this._spacesDomain.promise()
            .timeout(CONNECTION_TIMEOUT_MS)
            .catch(Promise.TimeoutError, function () {
                throw new Error("Could not connect to generator plugin because the connection timed out!");
            });
    };

    /**
     * A simple test to see if this service is open for business
     *
     * @return {boolean}
     */
    ExportService.prototype.ready = function () {
        return this._spacesDomain && this._spacesDomain.ready();
    };

    /**
     * Explicitly disconnects the websocket connection
     *
     * @return {Promise}
     */
    ExportService.prototype.close = function () {
        if (this._spacesDomain && this._spacesDomain.ready()) {
            this._spacesDomain.connection.disconnect();
        }
        return Promise.resolve();
    };

    /**
     * Export a layer asset
     *
     * @param {Layer} layer
     * @param {ExportAsset} asset
     *
     * @return {Promise.<string>} Promise of a File Path of the exported asset
     */
    ExportService.prototype.exportLayerAsset = function (layer, asset) {
        var payload = {
            layer: layer,
            scale: asset.scale,
            suffix: asset.suffix,
            format: asset.format
        };

        if (!this._spacesDomain) {
            throw new Error ("Can not exportLayerAsset prior to ExportService.init()");
        }

        return this._spacesDomain.exec("exportLayer", payload)
            .timeout(CONNECTION_TIMEOUT_MS)
            .then(function (exportResponse) {
                if (Array.isArray(exportResponse) && exportResponse.length > 0) {
                    return exportResponse;
                } else {
                    log.error("Export failed for layer [%s], asset %s", layer.name, JSON.stringify(asset));
                    return Promise.reject("Export Failed");
                }
            })
            .catch(Promise.TimeoutError, function () {
                return Promise.reject("Generator call exportLayer has timed out");
            });
    };

    /**
     * The preference key of the generator domain, used to find the port number stored in photoshop
     * @type {string}
     */
    ExportService.domainPrefKey = GeneratorConnection.domainPrefKey(GENERATOR_DOMAIN_NAME);

    module.exports = ExportService;
});
