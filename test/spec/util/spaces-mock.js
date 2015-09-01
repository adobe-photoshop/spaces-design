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

    var SpacesProxy = require("./spaces-proxy");

    var SpacesMock = function () {
        var get = this._get.bind(this),
            play = this._play.bind(this),
            batchPlay = this._batchPlay.bind(this);

        SpacesProxy.call(this, get, play, batchPlay);

        this._getMocks = [];
        this._playMocks = [];

        this._mockGet = this._mockGet.bind(this);
        this._mockPlay = this._mockPlay.bind(this);
    };

    /**
     * @private
     * @type {Array.<object>|function} Array.<{test: function (object): boolean, 
     * response: {err: ?object, result: object=} or function(object): {err: ?object, result: object=}>
     */
    SpacesMock.prototype._getMocks = null;

    /**
     * @private
     * @type {Array.<object>|function} Array.<{test: function (string, object): boolean, 
     * response: {err: ?object, result: object=} or function(object): {err: ?object, result: object=}>
     */
    SpacesMock.prototype._playMocks = null;

    /**
     * Mock get method. Applies the first getMock response to the callback that
     * has a passing test. Throws if there is no getMock that matches the arguments.
     * 
     * @param {object} reference
     * @param {function(?object, object=)} callback
     */
    SpacesMock.prototype._get = function (reference, callback) {
        var mocked = this._getMocks.some(function (mock) {
            var testResult;

            try {
                testResult = mock.test(reference);
            } catch (e) {
                testResult = false;
            }

            if (testResult) {
                var response;
                if (typeof mock.response === "function") {
                    response = mock.response(reference);
                } else {
                    response = mock.response;
                }

                if (!response.hasOwnProperty("result") && !response.hasOwnProperty("err")) {
                    throw new Error("Mock response must have err or result property defined", response);
                }
                
                callback(response.err, response.result);
                return true;
            }
        });

        if (!mocked) {
            throw new Error("Action reference not mocked", reference);
        }
    };

    /**
     * Mock play method. Applies the first playMock response to the callback that
     * has a passing test. Throws if there is no playMock that matches the arguments.
     * 
     * @param {string} command
     * @param {object} descriptor
     * @param {object} options
     * @param {function(?object, object=)} callback
     */
    SpacesMock.prototype._play = function (command, descriptor, options, callback) {
        var mocked = this._playMocks.some(function (mock) {
            var testResult;

            try {
                testResult = mock.test(command, descriptor);
            } catch (e) {
                testResult = false;
            }

            if (testResult) {
                var response;
                if (typeof mock.response === "function") {
                    response = mock.response(command, descriptor);
                } else {
                    response = mock.response;
                }

                if (!response.hasOwnProperty("result") && !response.hasOwnProperty("err")) {
                    throw new Error("Mock response must have err or result property defined", response);
                }

                callback(response.err, response.result);
                return true;
            }
        });

        if (!mocked) {
            throw new Error("Action descriptor not mocked", command);
        }
    };

    /**
     * Mock batchPlay method. Iteratively applies play using mocked play calls.
     * 
     * @param {Array.<{name: string, command: object}>} commands
     * @param {object} options
     * @param {function(?object, Array.object<>, Array.<object>)} callback
     */
    SpacesMock.prototype._batchPlay = function (commands, options, callback) {
        var length = commands.length,
            responses = [],
            errors = [];

        var _playHelper = function (index) {
            if (index === length) {
                callback(null, responses, errors);
                return;
            }

            this._play(commands[index].name, commands[index].descriptor, options, function (err, response) {
                if (err) {
                    errors[index] = err;

                    if (!options.continueOnError) {
                        callback(err, responses, errors);
                        return;
                    }
                } else {
                    errors[index] = null;
                }

                responses[index] = response;

                _playHelper(++index);
            });
        }.bind(this);

        _playHelper(0);
    };

    /**
     * Helper function to add a mock response to _spaces.ps.descriptor.get
     * 
     * @private
     * @param {function(object): boolean} test Function that, when applied to
     *  an action reference, returns true if the given response should be applied.
     * @param {{err: ?object, result: object=} | function(object): {err: ?object, result: object=}} response
     *  Response object, or a function parametrized by the request reference
     *  that returns a response object.
     */
    SpacesMock.prototype._mockGet = function (test, response) {
        this._getMocks.push({
            test: test,
            response: response
        });
    };

    /**
     * Helper function to add a mock response to _spaces.ps.descriptor.play
     * 
     * @private
     * @param {function(string, object): boolean} test Function that, when
     *  applied to a command name and action descriptor, returns true if the
     *  given response should be applied.
     * @param {{err: ?object, result: object=} | function(object): {err: ?object, result: object=}} response
     *  Response object, or a function parametrized by the request command name
     *  and action descriptor that returns a response object.
     */
    SpacesMock.prototype._mockPlay = function (test, response) {
        this._playMocks.push({
            test: test,
            response: response
        });
    };

    module.exports = SpacesMock;
});
