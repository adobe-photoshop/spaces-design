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

    var _ = require("lodash"),
        Promise = require("bluebird"),
        descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer"),
        unitLib = require("adapter/lib/unit");

    var events = require("../events"),
        log = require("../util/log"),
        locks = require("js/locks");
    
    /**
     * Helper function for setPosition action, prepares the playobject
     * @private
     * @param {number} documentID
     * @param {number} layerID
     * @param {{x: number, y: number}} position
     * @return {PlayObject}
     */
    var _getTranslatePlayObject = function (documentID, layerID, position) {
        var boundsStore = this.flux.store("bounds"),
            documentRef = documentLib.referenceBy.id(documentID),
            layerRef = [documentRef, layerLib.referenceBy.id(layerID)],
            layerBounds = boundsStore.getLayerBounds(documentID, layerID),
            newX = position.hasOwnProperty("x") ? position.x : layerBounds.left,
            newY = position.hasOwnProperty("y") ? position.y : layerBounds.top,
            xDelta = unitLib.pixels(newX - layerBounds.left),
            yDelta = unitLib.pixels(newY - layerBounds.top),
            translateObj = layerLib.translate(layerRef, xDelta, yDelta);

        return translateObj;
    };

    /**
     * Sets the given layers' positions
     *
     * @param {number} documentID Owner document ID
     * @param {number|Array.<number>} layerSpec Either an ID of single layer that
     *  the selection is based on, or an array of such layer IDs
     * @param {{x: number, y: number}} position New top and left values for each layer
     *
     * @return {Promise}
     */
    var setPositionCommand = function (documentID, layerSpec, position) {
        if (!_.isArray(layerSpec)) {
            layerSpec = [layerSpec];
        }

        var payload = {
                documentID: documentID,
                layerIDs: layerSpec,
                position: position
            };

        var boundsStore = this.flux.store("bounds"),
            documentRef = documentLib.referenceBy.id(documentID);

            
        if (layerSpec.length === 1) {
            var translatePromises = layerSpec.map(function (layerID) {
                var translateObj = _getTranslatePlayObject.call(this, documentID, layerID, position);

                return descriptor.playObject(translateObj);
            }, this);

            this.dispatch(events.transform.TRANSLATE_LAYERS, payload);
                
            return Promise.all(translatePromises)
                .bind(this)
                .catch(function (err) {
                    log.warn("Failed to translate layers", layerSpec, err);
                    this.dispatch(events.transform.TRANSLATE_LAYERS_FAILED);
                    this.flux.actions.documents.resetDocuments();
                }.bind(this));
        } else {
            // Photoshop does not apply "transform" objects to the referenced layer, and instead 
            // applies it to all selected layers, so here we deselectAll, 
            // and in chunks select one and move it and reselect all layers.
            // This is a temporary work around until we fix the underlying issue on PS side


            // We need to do this now, otherwise store gets updated before we can read current values
            var translateObjects = layerSpec.map(function (layerID) { 
                return _getTranslatePlayObject.call(this, documentID, layerID, position);
            }, this);

            this.dispatch(events.transform.TRANSLATE_LAYERS, payload);
            
            return descriptor.playObject(layerLib.deselectAll()).bind(this).then(function () {
                return Promise.each(layerSpec, function (layerID, index) {
                    var layerRef = layerLib.referenceBy.id(layerID),
                        selectObj = layerLib.select([documentRef, layerRef]),
                        translateObj = translateObjects[index];
                    
                    return descriptor.playObject(selectObj).then(function () {
                        return descriptor.playObject(translateObj);
                    });
                }.bind(this));
            }).then(function () {
                var layerRef = layerSpec.map(function (layerID) {
                    return layerLib.referenceBy.id(layerID);
                });
                layerRef.unshift(documentRef);

                var selectAllObj = layerLib.select(layerRef);
                return descriptor.playObject(selectAllObj);
            })
            .bind(this)
            .catch(function (err) {
                log.warn("Failed to translate layers", layerSpec, err);
                this.dispatch(events.transform.TRANSLATE_LAYERS_FAILED);
                this.flux.actions.documents.resetDocuments();
            }.bind(this));
        }
    };

    /**
     * Helper function for resize action, calculates the new x/y values for a layer
     * when it's resized so the layer is resized from top left
     * @private
     * @param {number} documentID
     * @param {number} layerID
     * @param {{w: number, h: number}} size
     * @return {PlayObject}
     */
    var _getResizePlayObject = function (documentID, layerID, size) {
        var boundsStore = this.flux.store("bounds"),
            documentRef = documentLib.referenceBy.id(documentID),
            layerBounds = boundsStore.getLayerBounds(documentID, layerID),
            newWidth = size.hasOwnProperty("w") ? size.w : layerBounds.width,
            newHeight = size.hasOwnProperty("h") ? size.h : layerBounds.height,
            widthDiff = newWidth - layerBounds.width,
            heightDiff = newHeight - layerBounds.height,
            pixelWidth = unitLib.pixels(newWidth),
            pixelHeight = unitLib.pixels(newHeight),
            xDelta = unitLib.pixels(widthDiff / 2),
            yDelta = unitLib.pixels(heightDiff / 2),
            layerRef = [documentRef, layerLib.referenceBy.id(layerID)],
            translateObj = layerLib.translate(layerRef, xDelta, yDelta),
            resizeObj = layerLib.setSize(layerRef, pixelWidth, pixelHeight),
            resizeAndMoveObj = _.merge(translateObj, resizeObj);

        return resizeAndMoveObj;

    };

    /**
     * Sets the given layers' sizes
     *
     * @param {number} documentID Owner document ID
     * @param {number|Array.<number>} layerSpec Either an ID of single layer that
     *  the selection is based on, or an array of such layer IDs
     * @param {w: {number}, h: {number}} size New width and height of the layers
     *
     * @returns {Promise}
     */
    var setSizeCommand = function (documentID, layerSpec, size) {
        if (!_.isArray(layerSpec)) {
            layerSpec = [layerSpec];
        }

        var payload = {
            documentID: documentID,
            layerIDs: layerSpec,
            size: size
        };

        var boundsStore = this.flux.store("bounds"),
            documentRef = documentLib.referenceBy.id(documentID);

        // Document
        if (layerSpec.length === 0) {
            var documentBounds = boundsStore.getDocumentBounds(documentID),
                newWidth = size.hasOwnProperty("w") ? size.w : documentBounds.width,
                newWidth = unitLib.pixels(newWidth),
                newHeight = size.hasOwnProperty("h") ? size.h : documentBounds.height,
                newHeight = unitLib.pixels(newHeight),
                resizeObj = documentLib.resize(newWidth, newHeight);

            this.dispatch(events.transform.RESIZE_DOCUMENT, payload);
            
            return descriptor.playObject(resizeObj)
                .bind(this)
                .catch(function (err) {
                    log.warn("Failed to resize layers", layerSpec, err);
                    this.dispatch(events.transform.RESIZE_DOCUMENT_FAILED);
                    this.flux.actions.documents.resetDocuments();
                }.bind(this));
        } else if (layerSpec.length === 1) {
        
            // We have this in a map function because setSize anchors center
            // We calculate the new translation values to keep the layer anchored on top left
            var resizePromises = layerSpec.map(function (layerID) {
                var resizeAndMoveObj = _getResizePlayObject.call(this, documentID, layerID, size);

                return descriptor.playObject(resizeAndMoveObj);
            }, this);

            this.dispatch(events.transform.RESIZE_LAYERS, payload);
            
            return Promise.all(resizePromises)
                .bind(this)
                .catch(function (err) {
                    log.warn("Failed to resize layers", layerSpec, err);
                    this.dispatch(events.transform.RESIZE_LAYERS_FAILED);
                    this.flux.actions.documents.resetDocuments();
                }.bind(this));
        } else {
            // We need to do this now, otherwise store gets updated before we can read current values
            var resizeObjects = layerSpec.map(function (layerID) { 
                return _getResizePlayObject.call(this, documentID, layerID, size);
            }, this);

            this.dispatch(events.transform.RESIZE_LAYERS, payload);
            
            return descriptor.playObject(layerLib.deselectAll()).bind(this).then(function () {
                return Promise.each(layerSpec, function (layerID, index) {
                    var layerRef = layerLib.referenceBy.id(layerID),
                        selectObj = layerLib.select([documentRef, layerRef]),
                        resizeAndMoveObj = resizeObjects[index];
                        
                    return descriptor.playObject(selectObj).then(function () {
                        return descriptor.playObject(resizeAndMoveObj);
                    });
                }.bind(this));
            }).then(function () {
                var layerRef = layerSpec.map(function (layerID) {
                    return layerLib.referenceBy.id(layerID);
                });
                layerRef.unshift(documentRef);

                var selectAllObj = layerLib.select(layerRef);
                return descriptor.playObject(selectAllObj);
            }).bind(this)
            .catch(function (err) {
                log.warn("Failed to resize layers", layerSpec, err);
                this.dispatch(events.transform.RESIZE_LAYERS_FAILED);
                this.flux.actions.documents.resetDocuments();
            }.bind(this));
        }
    };



    var setPosition = {
        command: setPositionCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    var setSize = {
        command: setSizeCommand,
        reads: [locks.PS_DOC, locks.JS_DOC],
        writes: [locks.PS_DOC, locks.JS_DOC]
    };

    exports.setPosition = setPosition;
    exports.setSize = setSize;
});
