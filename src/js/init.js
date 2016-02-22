/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

define(function (require) {
    "use strict";

    var Promise = require("bluebird");

    var descriptor = require("adapter").ps.descriptor,
        appLib = require("adapter").lib.application,
        documentLib = require("adapter").lib.document;

    var ui = require("./util/ui"),
        nls = require("./util/nls");

    var stylesReady = ui.getPSColorStop(),
        localeReady = nls.initLocaleInfo(),
        windowReady = new Promise(function (resolve) {
            if (window.document.readyState === "complete") {
                resolve();
            } else {
                window.addEventListener("load", resolve);
            }
        });

    var appRef = appLib.referenceBy.current,
        rangeOpts = {
            range: "document",
            index: 1
        };

    /**
     * Properties to be included when requesting document
     * descriptors from Photoshop.
     * 
     * @private
     * @type {Array.<string>} 
     */
    var _documentProperties = [
        "documentID",
        "title",
        "itemIndex",
        "hasBackgroundLayer",
        "numberOfLayers",
        "resolution",
        "width",
        "height",
        "mode",
        "isDirty"
    ];

    /**
     * Properties to be included if present when requesting
     * document descriptors from Photoshop.
     * 
     * @private
     * @type {Array.<string>} 
     */
    var _optionalDocumentProperties = [
        "targetLayers",
        "guidesVisibility",
        "smartGuidesVisibility",
        "format",
        "numberOfGuides"
    ];

    /**
     * Get a document descriptor for the given document reference. Only the
     * properties listed in _documentProperties will be included for performance
     * reasons.
     *
     * @private
     * @param {object} reference
     * @param {Array.<string>=} properties The properties to fetch. Defaults to
     *  _document properties.
     * @param {Array.<string>=} optionalProperties The optional properties to fetch.
     *  Defaults to _optionalDocumentProperties.
     * @return {Promise.<object>}
     */
    var _getDocumentByRef = function (reference, properties, optionalProperties) {
        if (properties === undefined) {
            properties = _documentProperties;
        }

        if (optionalProperties === undefined) {
            optionalProperties = _optionalDocumentProperties;
        }

        var documentPropertiesPromise = descriptor
                .multiGetProperties(reference, properties, {
                    cache: {
                        id: "documentProperties",
                        set: true
                    }
                });
            
        descriptor.multiGetOptionalProperties(reference, optionalProperties, {
            cache: {
                id: "documentOptionalProperties",
                set: true
            }
        });

        return documentPropertiesPromise;

        // // fetch exports metadata via document extension data
        // var nameSpace = global.EXTENSION_DATA_NAMESPACE,
        //     extensionPlayObject = documentLib.getExtensionData(reference, nameSpace),
        //     extensionPromise = descriptor
        //         .playObject(extensionPlayObject, {
        //             cache: {
        //                 id: "documentMetadata",
        //                 set: true
        //             }
        //         })
        //         .then(function (extensionData) {
        //             var extensionDataRoot = extensionData[nameSpace];
        //             return (extensionDataRoot && extensionDataRoot.exportsMetadata) || {};
        //         });

        // return Promise.join(documentPropertiesPromise, optionalPropertiesPromise, extensionPromise);
    };

    /**
     * Properties to be included when requesting layer
     * descriptors from Photoshop.
     * @private
     * @type {Array.<string>} 
     */
    var _layerProperties = [
        "layerID",
        "name",
        "visible",
        "layerLocking",
        "itemIndex",
        "background",
        "boundsNoMask",
        "boundsNoEffects",
        "mode"
    ];

    /**
     * Basic optional properties to request of layer descriptors from Photoshop.
     * When initializing documents, these are the only properties requested for
     * non-selected layers.
     * 
     * @private
     * @type {Array.<string>} 
     */
    var _optionalLayerProperties = [
        "boundingBox",
        "layerKind",
        "artboard",
        "artboardEnabled",
        "smartObject",
        "layerSectionExpanded",
        "vectorMaskEnabled",
        "vectorMaskEmpty",
        "textWarningLevel"
    ];

    // /**
    //  * Inessential optional properties to request of layer descriptors from Photoshop.
    //  * When initializing documents, these properties are NOT requested for non-selected
    //  * layers.
    //  *
    //  * @private
    //  * @type {Array.<string>}
    //  */
    // var _lazyLayerProperties = [
    //     "layerID", // redundant but useful for matching results
    //     "globalAngle",
    //     "pathBounds",
    //     "proportionalScaling",
    //     "adjustment",
    //     "AGMStrokeStyleInfo",
    //     "textKey",
    //     "fillEnabled",
    //     "fillOpacity",
    //     "keyOriginType",
    //     "layerEffects",
    //     "layerFXVisible", // the following are required but this is not enforced
    //     "opacity"
    // ];

    // /**
    //  * Namespace for extension metadata.
    //  * 
    //  * @const
    //  * @type {string}
    //  */
    // var METADATA_NAMESPACE = global.EXTENSION_DATA_NAMESPACE;

    /**
     * Get all layer descriptors for the given document reference. Only the
     * properties listed in the arrays above will be included for performance
     * reasons.
     * 
     * @private
     * @param {object} doc A document descriptor
     * @return {Promise.<Array.<object>>}
     */
    var _getLayersForDocument = function (doc) {
        var documentID = doc.documentID,
            startIndex = doc.hasBackgroundLayer ? 0 : 1,
            docRef = documentLib.referenceBy.id(documentID),
            rangeOpts = {
                range: "layer",
                index: startIndex,
                count: -1
            };

        var requiredPropertiesPromise = descriptor.getPropertiesRange(docRef, rangeOpts, _layerProperties, {
            failOnMissingProperty: true,
            cache: {
                id: "layerProperties",
                set: true
            }
        });

        var optionalPropertiesPromise = descriptor.getPropertiesRange(docRef, rangeOpts, _optionalLayerProperties, {
            failOnMissingProperty: false,
            cache: {
                id: "layerOptionalProperties",
                set: true
            }
        });

        return Promise.join(requiredPropertiesPromise, optionalPropertiesPromise);

        // var targetLayers = doc.targetLayers || [],
        //     targetRefs = targetLayers.map(function (target) {
        //         return [
        //             docRef,
        //             layerLib.referenceBy.index(startIndex + target._index)
        //         ];
        //     });

        // var lazyPropertiesPromise = descriptor.batchMultiGetProperties(targetRefs, _lazyLayerProperties, {
        //     continueOnError: true
        // });

        // var extensionPromise;
        // if (doc.hasBackgroundLayer && doc.numberOfLayers === 0 && targetLayers.length === 1) {
        //     // Special case for background-only documents, which can't contain metadata
        //     extensionPromise = Promise.resolve([{}]);
        // } else {
        //     var extensionPlayObjects = targetRefs.map(function (refObj) {
        //         var layerRef = refObj[1];
        //         return layerLib.getExtensionData(docRef, layerRef, METADATA_NAMESPACE);
        //     });

        //     extensionPromise = descriptor.batchPlayObjects(extensionPlayObjects)
        //         .map(function (extensionData) {
        //             var extensionDataRoot = extensionData[METADATA_NAMESPACE];
        //             return (extensionDataRoot && extensionDataRoot.exportsMetadata) || {};
        //         });
        // }

        // return Promise.join(requiredPropertiesPromise, optionalPropertiesPromise,
        //     function (required, optional) {
        //         return _.zipWith(required, optional, _.merge);
        //     })
        //     .tap(function (properties) {
        //         var propertiesByID = _.indexBy(properties, "layerID");

        //         return extensionPromise.then(function (allData) {
        //             return lazyPropertiesPromise.each(function (lazyProperties, index) {
        //                 if (!lazyProperties) {
        //                     // A background will not have a layer ID
        //                     return;
        //                 }

        //                 var lazyLayerID = lazyProperties.layerID,
        //                     extensionData = allData[index];

        //                 _.merge(propertiesByID[lazyLayerID], lazyProperties, extensionData);
        //             });
        //         });
        //     })
        //     .then(function (properties) {
        //         return properties.reverse();
        //     });
    };

    descriptor
        .getPropertyRange(appRef, rangeOpts, "documentID", {
            cache: {
                id: "documentIDs",
                set: true
            }
        })
        .then(function (documentIDs) {
            if (documentIDs.length > 0) {
                var currentRef = documentLib.referenceBy.current;
                
                return _getDocumentByRef(currentRef)
                    .bind(this)
                    .then(function (currentDoc) {
                        return _getLayersForDocument(currentDoc);
                    });
            }
        });

    require(["./main"], function (main) {
        Promise.join(stylesReady, localeReady, windowReady, function (stop) {
            main.startup(stop);
            window.addEventListener("beforeunload", main.shutdown.bind(main));
        });
    });
});
