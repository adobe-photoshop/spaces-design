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

    /**
     * @constructor
     */
    var DescriptorMock = function () {
        this._getMocks = [];
        this._playMocks = [];
    };

    /**
     * @private
     * @type {Array.<{test: function (object): boolean,
     *  response: {err: ?object, result: object=} | function(object): {err: ?object, result: object=}>}
     */
    DescriptorMock.prototype._getMocks = null;

    /**
     * @private
     * @type {Array.<{test: function (string, object): boolean,
     *  response: {err: ?object, result: object=} | function(object): {err: ?object, result: object=}>}
     */
    DescriptorMock.prototype._playMocks = null;

    /**
     * Mock play method. Applies the first playMock response to the callback that
     * has a passing test. Throws if there is no playMock that matches the arguments.
     * 
     * @param {string} command
     * @param {object} descriptor
     * @param {object} options
     * @param {function(?object, object=)} callback
     */
    DescriptorMock.prototype.play = function (command, descriptor, options, callback) {
        var mocked = this._playMocks.some(function (mock) {
            var testResult = mock.test(command, descriptor);

            if (testResult) {
                var response;
                if (typeof mock.response === "function") {
                    response = mock.response(command, descriptor);
                } else {
                    response = mock.response;
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
     * Mock get method. Applies the first getMock response to the callback that
     * has a passing test. Throws if there is no getMock that matches the arguments.
     * 
     * @param {object} reference
     * @param {function(?object, object=)} callback
     */
    DescriptorMock.prototype.get = function (reference, callback) {
        var mocked = this._getMocks.some(function (mock) {
            var testResult = mock.test(reference);

            if (testResult) {
                var response;
                if (typeof mock.response === "function") {
                    response = mock.response(reference);
                } else {
                    response = mock.response;
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
     * @construcor
     */
    var PSMock = function () {
        this.descriptor = new DescriptorMock();
    };

    /**
     * @type {DescriptorMock}
     */
    PSMock.prototype.descriptor = null;

    /**
     * @constructor
     */
    var PlaygroundMock = function () {
        this.ps = new PSMock();
    };

    /**
     * @type {PSMock}
     */
    PlaygroundMock.prototype.ps = null;

    module.exports = PlaygroundMock;
});
