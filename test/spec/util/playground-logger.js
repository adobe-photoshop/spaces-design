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

    var PlaygroundProxy = require("./playground-proxy");

    var PlaygroundLogger = function (originalPlayground) {
        var get = this._get.bind(this),
            play = this._play.bind(this),
            batchPlay = this._batchPlay.bind(this);

        PlaygroundProxy.call(this, get, play, batchPlay);

        this._gets = [];
        this._plays = [];
        this._calls = [];        
        this._originalPlayground = originalPlayground;
    };

    /**
     * @private
     */
    PlaygroundLogger.prototype._calls = null;

    /**
     * @private
     */
    PlaygroundLogger.prototype._gets = null;

    /**
     * @private
     */
    PlaygroundLogger.prototype._plays = null;

    /**
     * @param {object} reference
     * @param {function(?object, object=)} callback
     */
    PlaygroundLogger.prototype._get = function (reference, callback) {
        var call = {
            request: {
                reference: reference
            },
            response: {}
        };

        this._gets.push(call);
        this._calls.push(call);

        this._originalPlayground.ps.descriptor.get(reference, function (err, result) {
            if (err) {
                call.response.err = err;
            } else {
                call.response.err = null;
                call.response.result = result;
            }

            callback(err, result);
        });
    };

    /**
     * @param {string} command
     * @param {object} descriptor
     * @param {object} options
     * @param {function(?object, object=)} callback
     */
    PlaygroundLogger.prototype._play = function (command, descriptor, options, callback) {
        var call = {
            request: {
                options: options,
                command: command,
                descriptor: descriptor
            },
            response: {}
        };

        this._plays.push(call);
        this._calls.push(call);

        this._originalPlayground.ps.descriptor.play(command, descriptor, options, function (err, result) {
            if (err) {
                call.response.err = err;
            } else {
                call.response.err = null;
                call.response.result = result;
            }

            callback(err, result);
        });
    };

    /**
     * Mock batchPlay method. Iteratively applies play using mocked play calls.
     * 
     * @param {Array.<{name: string, command: object}>} commands
     * @param {object} options
     * @param {object} batchOptions
     * @param {function(?object, Array.object<>, Array.<object>)} callback
     */
    PlaygroundLogger.prototype._batchPlay = function (commands, options, batchOptions, callback) {
        var start = this._calls.length;

        commands.forEach(function (command) {
            var call = {
                play: true,
                request: {
                    options: options,
                    command: command.name,
                    descriptor: command.descriptor
                },
                response: {}
            };

            this._plays.push(call);
            this._calls.push(call);
        }, this);

        this._originalPlayground.ps.descriptor.batchPlay(commands, options, batchOptions,
            function (err, results, errors) {
                if (err && !batchOptions.continueOnError) {
                    var throwable = new Error("Unable to log aborted batchPlay call");
                    throwable.cause = err;
                    throw throwable;
                }

                results.forEach(function (result, index) {
                    var call = this._calls[start + index];
                    call.response.err = errors[start + index];
                    call.response.result = result;
                }, this);

                callback(err, results, errors);
            }.bind(this));
    };

    module.exports = PlaygroundLogger;
});
