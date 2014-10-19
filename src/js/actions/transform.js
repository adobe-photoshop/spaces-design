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
        layerLib = require("adapter/lib/layer");

    var events = require("../events"),
        log = require("../util/log"),
        locks = require("js/locks");
    
    /**
     * Sets the given layers' positions
     *
     * @param {number} documentID Owner document ID
     * @param {number|Array.<number>} layerSpec Either an ID of single layer that
     *  the selection is based on, or an array of such layer IDs
     * @param {x: {number}, y: {number}} position New top and left values for each layer
     *
     * @returns {Promise}
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
                var layerBounds = boundsStore.getLayerBounds(documentID, layerID),
                    newX = position.x ? position.x : layerBounds.left,
                    newY = position.y ? position.y : layerBounds.top,
                    xDelta = newX - layerBounds.left,
                    yDelta = newY - layerBounds.top,
                    layerRef = [documentRef, layerLib.referenceBy.id(layerID)],
                    translateObj = layerLib.translate(layerRef, xDelta, "pixels", yDelta, "pixels");

                    
                return descriptor.playObject(translateObj);
            });


            return Promise.all(translatePromises)
                .bind(this)
                .then(function () {
                    this.dispatch(events.transform.TRANSLATE_LAYERS, payload);
                })
                .catch(function (err) {
                    log.warn("Failed to translate layers", layerSpec, err);
                    this.dispatch(events.transform.TRANSLATE_LAYERS_FAILED);
                    this.flux.actions.documents.resetDocuments();
                }.bind(this));
        } else {
            return descriptor.playObject(layerLib.deselectAll()).then(function () {
                return Promise.each(layerSpec, function (layerID) {
                    var layerBounds = boundsStore.getLayerBounds(documentID, layerID),
                        newX = position.x ? position.x : layerBounds.left,
                        newY = position.y ? position.y : layerBounds.top,
                        xDelta = newX - layerBounds.left,
                        yDelta = newY - layerBounds.top,
                        layerRef = layerLib.referenceBy.id(layerID),
                        selectObj = layerLib.select([documentRef, layerRef]),
                        translateObj = layerLib.translate(layerLib.referenceBy.current,
                                            xDelta, "pixels",
                                            yDelta, "pixels");

                    return descriptor.playObject(selectObj).then(function () {
                        return descriptor.playObject(translateObj);
                    });
                });
            }).then(function () {
                var layerRef = layerSpec.map(function (layerID) {
                    return layerLib.referenceBy.id(layerID);
                });
                layerRef.unshift(documentRef);

                var selectAllObj = layerLib.select(layerRef);
                return descriptor.playObject(selectAllObj);
            }).bind(this)
                .then(function () {
                    this.dispatch(events.transform.TRANSLATE_LAYERS, payload);
                })
                .catch(function (err) {
                    log.warn("Failed to translate layers", layerSpec, err);
                    this.dispatch(events.transform.TRANSLATE_LAYERS_FAILED);
                    this.flux.actions.documents.resetDocuments();
                }.bind(this));
        }
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
                newWidth = size.w ? size.w : documentBounds.width,
                newHeight = size.h ? size.h : documentBounds.height,
                resizeObj = documentLib.resize(newWidth, newHeight);

            return descriptor.playObject(resizeObj)
                .bind(this)
                .then(function () {
                    this.dispatch(events.transform.RESIZE_DOCUMENT, payload);
                })
                .catch(function (err) {
                    log.warn("Failed to resize layers", layerSpec, err);
                    this.dispatch(events.transform.RESIZE_DOCUMENT_FAILED);
                    this.flux.actions.documents.resetDocuments();
                }.bind(this));
        } else if (layerSpec.length === 1) {
        
            // We have this in a map function because setSize anchors center
            // We calculate the new translation values to keep the layer anchored on top left
            var resizePromises = layerSpec.map(function (layerID) {
                var layerBounds = boundsStore.getLayerBounds(documentID, layerID),
                    newWidth = size.w ? size.w : layerBounds.width,
                    newHeight = size.h ? size.h : layerBounds.height,
                    widthDiff = newWidth - layerBounds.width,
                    heightDiff = newHeight - layerBounds.height,
                    xDelta = widthDiff / 2,
                    yDelta = heightDiff / 2,
                    layerRef = [documentRef, layerLib.referenceBy.id(layerID)],
                    translateObj = layerLib.translate(layerRef, xDelta, "pixels", yDelta, "pixels"),
                    resizeObj = layerLib.setSize(layerRef, newWidth, "pixels", newHeight, "pixels"),
                    resizeAndMoveObj = _.merge(translateObj, resizeObj);

                
                return descriptor.playObject(resizeAndMoveObj);
            });


            return Promise.all(resizePromises)
                .bind(this)
                .then(function () {
                    this.dispatch(events.transform.RESIZE_LAYERS, payload);
                })
                .catch(function (err) {
                    log.warn("Failed to resize layers", layerSpec, err);
                    this.dispatch(events.transform.RESIZE_LAYERS_FAILED);
                    this.flux.actions.documents.resetDocuments();
                }.bind(this));
        } else {
            return descriptor.playObject(layerLib.deselectAll()).then(function () {
                return Promise.each(layerSpec, function (layerID) {
                    var layerBounds = boundsStore.getLayerBounds(documentID, layerID),
                        newWidth = size.w ? size.w : layerBounds.width,
                        newHeight = size.h ? size.h : layerBounds.height,
                        widthDiff = newWidth - layerBounds.width,
                        heightDiff = newHeight - layerBounds.height,
                        xDelta = widthDiff / 2,
                        yDelta = heightDiff / 2,
                        layerRef = layerLib.referenceBy.id(layerID),
                        selectObj = layerLib.select([documentRef, layerRef]),
                        translateObj = layerLib.translate(layerRef, xDelta, "pixels", yDelta, "pixels"),
                        resizeObj = layerLib.setSize(layerRef, newWidth, "pixels", newHeight, "pixels"),
                        resizeAndMoveObj = _.merge(translateObj, resizeObj);

                    return descriptor.playObject(selectObj).then(function () {
                        return descriptor.playObject(resizeAndMoveObj);
                    });
                });
            }).then(function () {
                var layerRef = layerSpec.map(function (layerID) {
                    return layerLib.referenceBy.id(layerID);
                });
                layerRef.unshift(documentRef);

                var selectAllObj = layerLib.select(layerRef);
                return descriptor.playObject(selectAllObj);
            }).bind(this)
                .then(function () {
                    this.dispatch(events.transform.RESIZE_LAYERS, payload);
                })
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
