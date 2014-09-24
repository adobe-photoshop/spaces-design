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

    var Fluxxor = require("fluxxor"),
        events = require("../events");

    var LayerStore = Fluxxor.createStore({
        layerKinds: Object.defineProperties({}, {
            ANY: {
                writeable: false,
                enumerable: true,
                value:  0
            },
            PIXEL: {
                writeable: false,
                enumerable: true,
                value:  1
            },
            ADJUSTMENT: {
                writeable: false,
                enumerable: true,
                value:  2
            },
            TEXT: {
                writeable: false,
                enumerable: true,
                value:  3
            },
            VECTOR: {
                writeable: false,
                enumerable: true,
                value:  4
            },
            SMARTOBJECT: {
                writeable: false,
                enumerable: true,
                value:  5
            },
            VIDEO: {
                writeable: false,
                enumerable: true,
                value:  6
            },
            GROUP: {
                writeable: false,
                enumerable: true,
                value:  7
            },
            "3D": {
                writeable: false,
                enumerable: true,
                value:  8
            },
            GRADIENT: {
                writeable: false,
                enumerable: true,
                value:  9
            },
            PATTERN: {
                writeable: false,
                enumerable: true,
                value:  10
            },
            SOLIDCOLOR: {
                writeable: false,
                enumerable: true,
                value:  11
            },
            BACKGROUND: {
                writeable: false,
                enumerable: true,
                value:  12
            },
            GROUPEND: {
                writeable: false,
                enumerable: true,
                value:  13
            }
        }),

        initialize: function () {
            this._layerTree = {};
            this._currentDocLayers = {children: []};
            this.bindActions(
                events.layers.LAYERS_UPDATED, this.layersUpdated
            );
        },

        getState: function () {
            return {
                currentDocumentLayers: this._currentDocLayers
            };
        },

        layersUpdated: function (payload) {
            var documentState = this.flux.store("document").getState(),
                activeDocumentID = documentState.selectedDocumentID;


            this._layerTree = payload.allLayers;
            this._currentDocLayers = payload.allLayers[activeDocumentID];

            this.emit("change");
        },

        getLayerKinds: function () {
            return {
                "any": 0,
                "pixel": 1,
                "adjustment": 2,
                "text": 3,
                "vector": 4,
                "smartobject": 5,
                "video": 6,
                "group": 7,
                "3d": 8,
                "gradient": 9,
                "pattern": 10,
                "solidcolor": 11,
                "background": 12,
                "groupend": 13
            };
        }
    });
    module.exports = new LayerStore();
});
