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

    // namespaced raw (unsynchronized) actions
    module.exports = {
        application: require("./application"),
        dialog: require("./dialog"),
        documents: require("./documents"),
        edit: require("./edit"),
        example: require("./example"),
        help: require("./help"),
        history: require("./history"),
        keyevents: require("./keyevents"),
        layers: require("./layers"),
        layerEffects: require("./layereffects"),
        menu: require("./menu"),
        policy: require("./policy"),
        preferences: require("./preferences"),
        search: require("./search"),
        shapes: require("./shapes"),
        shortcuts: require("./shortcuts"),
        superselect: require("./superselect"),
        tools: require("./tools"),
        transform: require("./transform"),
        type: require("./type"),
        ui: require("./ui")
    };
});
