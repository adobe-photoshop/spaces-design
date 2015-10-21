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

    var Immutable = require("immutable");
    
    var adapter = require("adapter"),
        descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        hitTestLib = require("adapter/lib/hitTest");

    var Bounds = require("js/models/bounds"),
        Color = require("js/models/color"),
        headlights = require("js/util/headlights");

    /**
     * Calculates the bounds of the name badge, used for artboards
     *
     * @param {Bounds} bounds The bounds of the artboard in question
     * @param {number} scale UI Scale factor, since artboard names don't scale with zoom level
     * @return {Bounds}
     */
    var getNameBadgeBounds = function (bounds, scale) {
        var newWidth = Math.max(bounds.width / 3, Math.min(100 * scale, bounds.width)),
            newHeight = 13 * scale,
            padding = 10 * scale;

        return new Bounds({
            top: bounds.top - padding - newHeight,
            bottom: bounds.top - padding,
            left: bounds.left,
            right: bounds.left + newWidth
        });
    };

    /**
     * Asynchronously get the basic list of hit layer IDs in given document
     *
     * @param {number} id Document ID
     * @param {number} x Horizontal coordinate
     * @param {number} y Vertical coordinate
     * @return {Promise.<Immutable.List<number>>}
     */
    var hitTestLayers = function (id, x, y) {
        var documentRef = documentLib.referenceBy.id(id),
            hitPlayObj = hitTestLib.layerIDsAtPoint(documentRef, x, y);

        return descriptor.playObject(hitPlayObj)
            .get("layersHit")
            .then(function (ids) {
                return Immutable.List(ids);
            }, function () {
                return Immutable.List();
            });
    };

    /**
     * Asynchronously get the color at the pixel of given coordinates in the document
     *
     * @param {number} id Document ID 
     * @param {number} x Horizontal coordinate
     * @param {number} y Vertical coordinate
     * @param {number=} opacity Opacity of the owner layer at the pixel
     * @return {Promise.<Color>}
     */
    var colorAtPoint = function (id, x, y, opacity) {
        var documentRef = documentLib.referenceBy.id(id),
            hitPlayObj = hitTestLib.colorSampleAtPoint(documentRef, Math.round(x), Math.round(y));

        opacity = (opacity === undefined) ? 100 : opacity;
        
        return descriptor.playObject(hitPlayObj)
            .then(function (result) {
                if (result.sampledData) {
                    return Color.fromPhotoshopColorObj(result.colorSampler, opacity);
                } else {
                    return null;
                }
            });
    };
    
    /**
     * Open passed URL, stops event propagation
     *
     * @param {string} url
     * @param {SyntheticEvent?} event
     * @param {string} name
     */
    var openURL = function (url, event, name) {
        adapter.openURLInDefaultBrowser(url);

        headlights.logEvent("UserInterface", "introduction", name);

        if (event && event.stopPropagation) {
            event.stopPropagation();
        }
    };

    /**
     * Parses the given refPoint string and returns the keys to be passed into
     * a bounds object
     *
     * @param {string} refPoint Two character string denoting the active reference point [lmr][tcb]
     *
     * @return {{x: string, y: string}} Keys referring to the value in Bounds object 
     * to get the desired reference point
     */
    var getPositionKeysByRefPoint = function (refPoint) {
        if (refPoint.length !== 2) {
            throw new Error("Invalid reference point provided: " + refPoint);
        }

        var xKey, yKey;

        switch (refPoint[0]) {
            case "l":
                xKey = "left";
                break;
            case "m":
                xKey = "xCenter";
                break;
            case "r":
                xKey = "right";
                break;
            default:
                throw new Error("Invalid reference point provided: " + refPoint);
        }

        switch (refPoint[1]) {
            case "t":
                yKey = "top";
                break;
            case "c":
                yKey = "yCenter";
                break;
            case "b":
                yKey = "bottom";
                break;
            default:
                throw new Error("Invalid reference point provided: " + refPoint);
        }

        return {
            x: xKey,
            y: yKey
        };
    };

    exports.getNameBadgeBounds = getNameBadgeBounds;
    exports.hitTestLayers = hitTestLayers;
    exports.colorAtPoint = colorAtPoint;
    exports.openURL = openURL;
    exports.getPositionKeysByRefPoint = getPositionKeysByRefPoint;
});
