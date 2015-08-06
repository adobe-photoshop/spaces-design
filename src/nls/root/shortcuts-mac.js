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

/*global define */
/*jscs:disable maximumLineLength*/
/*jshint -W101*/

define(function (require, exports, module) {
    "use strict";

    module.exports = {
        MENU: {
            APPLICATION: {
                HIDE_APPLICATION: "h",
                HIDE_OTHER_APPLICATIONS: "h",
                QUIT_APPLICATION_MAC: "q"
            },
            FILE: {
                NEW: "n",
                NEW_EXTENDED: "n",
                OPEN: "o",
                CLOSE: "w",
                SAVE: "s",
                SAVE_AS: "s",
                REVERT: "KEY_F12",
                PLACE_EMBEDDED: "p",
                PLACE_LINKED: "p",
                PRINT: "p"
            },
            EDIT: {
                UNDO: "z",
                REDO: "z",
                CUT: "x",
                COPY: "c",
                PASTE: "v",
                SELECT_ALL: "a",
                DESELECT: "a"
            },
            LAYER: {
                SEARCH: "f",
                EDIT_VECTOR_MASK: "k"
            },
            ARRANGE: {
                FLIP_HORIZONTAL: "/",
                FLIP_VERTICAL: "/",
                SWAP_POSITION: "/",
                LOCK_LAYER: "l",
                UNLOCK_LAYER: "l",
                GROUP_LAYERS: "g",
                UNGROUP_LAYERS: "g"
            },
            VIEW: {
                ZOOM_IN: "+",
                ZOOM_OUT: "-",
                FIT_TO_WINDOW: "0",
                ACTUAL_SIZE: "1",
                ZOOM_TO_SELECTION: "2",
                CENTER_SELECTION: "3",
                TOGGLE_SMART_GUIDES: ";",
                TOGGLE_GUIDES: "g"
            },
            WINDOW: {
                NEXT_DOCUMENT: "`",
                RETURN_TO_STANDARD: "`"
            },
            HELP: {
                RUN_TESTS: "?",
                UPDATE_CURRENT_DOCUMENT: ";",
                RESET_RECESS: "ESCAPE"
            }
        },
        GLOBAL: {
            TOOLS: {
                SELECT: "v",
                RECTANGLE: "r",
                SHAPE: "u",
                ELLIPSE: "e",
                PEN: "p",
                TYPE: "t",
                SAMPLER: "i"
            }
        }
    };
});
