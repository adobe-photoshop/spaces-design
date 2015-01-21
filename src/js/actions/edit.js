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

define(function (require, exports) {
    "use strict";

    var os = require("adapter/os");

    /**
     * Native menu command IDs for Photoshop edit commands.
     * 
     * @const     
     * @private
     * @type {number}
     */
    var CUT_NATIVE_MENU_COMMMAND_ID = 103,
        COPY_NATIVE_MENU_COMMMAND_ID = 104,
        PASTE_NATIVE_MENU_COMMMAND_ID = 105;

    /**
     * Determines whether the given element is an HTML input element.
     * 
     * @private
     * @param {HTMLElement} el
     * @return boolean
     */
    var _isInput = function (el) {
        return el instanceof window.HTMLInputElement;
    };

    /**
     * Determines whether the given input element is a textual element.
     * 
     * @private
     * @param {HTMLInputElement} el
     * @return boolean
     */
    var _isTextInput = function (el) {
        switch (el.type) {
            case "text":
            case "search":
            case "url":
            case "tel":
            case "password":
                return true;
            default:
                return false;
        }
    };

    /**
     * Execute either a cut or copy operation, depending on the value of the parameter.
     *
     * @private
     * @param {boolean} cut If true, perform a cut operation; otherwise, a copy.
     * @return {Promise}
     */
    var _cutOrCopyCommand = function (cut) {
        return os.hasKeyboardFocus()
            .bind(this)
            .then(function (cefHasFocus) {
                var el = document.activeElement;
                if (cefHasFocus && _isInput(el)) {
                    var data;
                    if (_isTextInput(el)) {
                        data = el.value.substring(el.selectionStart, el.selectionEnd);
                        if (cut) {
                            el.setRangeText("");
                        }
                    } else {
                        data = el.value;
                    }

                    return os.clipboardWrite(data);
                } else {
                    var commandID = cut ?
                        CUT_NATIVE_MENU_COMMMAND_ID :
                        COPY_NATIVE_MENU_COMMMAND_ID;

                    this.flux.actions.menu.native({
                        commandID: commandID
                    });
                }
            });
    };

    /**
     * Execute a cut operation on the currently active HTML element.
     *
     * @private
     * @return {Promise}
     */
    var cutCommand = function () {
        return _cutOrCopyCommand.call(this, true);
    };

    /**
     * Execute a copy operation on the currently active HTML element.
     *
     * @private
     * @return {Promise}
     */
    var copyCommand = function () {
        return _cutOrCopyCommand.call(this, false);
    };

    /**
     * Execute a paste operation on the currently active HTML element.
     *
     * @private
     * @return {Promise}
     */
    var pasteCommand = function () {
        return os.hasKeyboardFocus()
            .bind(this)
            .then(function (cefHasFocus) {
                var el = document.activeElement;
                if (cefHasFocus && _isInput(el)) {
                    return os.clipboardRead()
                        .then(function (result) {
                            var data = result.data,
                                format = result.format;

                            if (format !== "string") {
                                return;
                            }

                            if (_isTextInput(el)) {
                                var selectionStart = el.selectionStart;
                                el.setRangeText(data);
                                el.setSelectionRange(selectionStart + data.length, selectionStart + data.length);
                            } else {
                                el.value = data;
                            }
                        });
                } else {
                    this.flux.actions.menu.native({
                        commandID: PASTE_NATIVE_MENU_COMMMAND_ID
                    });
                }
            });
    };

    /**
     * Execute a select operation on the currently active HTML element.
     *
     * @private
     * @return {Promise}
     */
    var selectAllCommand = function () {
        return os.hasKeyboardFocus()
            .bind(this)
            .then(function (cefHasFocus) {
                var el = document.activeElement;
                if (cefHasFocus && _isInput(el)) {
                    if (_isTextInput(el)) {
                        el.setSelectionRange(0, el.value.length);
                    }
                } else {
                    this.flux.actions.layers.selectAll();
                }
            });
    };

    /**
     * @type {Action}
     */
    var cut = {
        command: cutCommand,
        reads: [],
        writes: []
    };

    /**
     * @type {Action}
     */
    var copy = {
        command: copyCommand,
        reads: [],
        writes: []
    };

    /**
     * @type {Action}
     */
    var paste = {
        command: pasteCommand,
        reads: [],
        writes: []
    };

    /**
     * @type {Action}
     */
    var selectAll = {
        command: selectAllCommand,
        reads: [],
        writes: []
    };

    exports.cut = cut;
    exports.copy = copy;
    exports.paste = paste;
    exports.selectAll = selectAll;
});
