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

    var Promise = require("bluebird"),
        _ = require("lodash");
        
    var descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        adapterUI = require("adapter/ps/ui"),
        adapterOS = require("adapter/os");

    var locks = require("js/locks"),
        events = require("js/events"),
        objUtil = require("js/util/object"),
        collection = require("js/util/collection"),
        policy = require("./policy"),
        EventPolicy = require("js/models/eventpolicy"),
        PointerEventPolicy = EventPolicy.PointerEventPolicy;

    /**
     * Properties to be included when requesting guide
     * descriptors from Photoshop.
     * @private
     * @type {Array.<string>} 
     */
    var _guideProperties = [
        "ID",
        "orientation",
        "position",
        "itemIndex",
        "kind"
    ];
    
    /** 
     * Properties that are not in all guides
     *
     * @type {Array.<string>}
     */
    var _optionalGuideProperties = [
        "layerID"
    ];

    /**
     * Get all the guide descriptors in the given document.
     * 
     * @private
     * @param {object} docRef A document reference
     * @return {Promise.<Array.<object>>}
     */
    var _getGuidesForDocumentRef = function (docRef) {
        var rangeOpts = {
                range: "guide",
                index: 1,
                count: -1
            };

        var requiredPromise = descriptor.getPropertiesRange(docRef, rangeOpts,
                _guideProperties, { failOnMissingProperty: true }),
            optionalPromise = descriptor.getPropertiesRange(docRef, rangeOpts,
                _optionalGuideProperties, { failOnMissingProperty: false });

        return Promise.join(requiredPromise, optionalPromise,
            function (required, optional) {
                return _.chain(required)
                    .zipWith(optional, _.merge)
                    .value();
            });
    };

    /**
     * Keeps track of current pointer propagation policy for editing guides
     *
     * @type {number}
     */
    var _currentGuidePolicyID = null;

    /**
     * Draws pointer policies around existing guides letting the mouse through to Photoshop
     *
     * @return {Promise}
     */
    var resetGuidePolicies = function () {
        var toolStore = this.flux.store("tool"),
            appStore = this.flux.store("application"),
            uiStore = this.flux.store("ui"),
            currentDocument = appStore.getCurrentDocument(),
            currentPolicy = _currentGuidePolicyID,
            currentTool = toolStore.getCurrentTool(),
            removePromise = currentPolicy ?
                this.transfer(policy.removePointerPolicies, currentPolicy, true) : Promise.resolve();
            
        // Make sure to always remove the remaining policies
        // even if there is no document, guides are invisible, there are no guides
        // or tool isn't select
        if (!currentDocument || !currentDocument.guidesVisible ||
            !currentDocument.guides || currentDocument.guides.isEmpty() ||
            !currentTool || currentTool.id !== "newSelect") {
            _currentGuidePolicyID = null;
            return removePromise;
        }

        // How thick the policy line should be while defined as an area around the guide
        var policyThickness = 2,
            guides = currentDocument.guides,
            canvasBounds = uiStore.getCloakRect(),
            topAncestors = currentDocument.layers.selectedTopAncestors,
            topAncestorIDs = collection.pluck(topAncestors, "id"),
            visibleGuides = guides.filter(function (guide) {
                return guide && (guide.isDocumentGuide || topAncestorIDs.has(guide.layerID));
            });

        if (!canvasBounds) {
            return Promise.resolve();
        }

        // Each guide is either horizontal or vertical with a specific position on canvas space
        // We need to create a rectangle around this guide that fits the window boundaries
        // that lets the mouse clicks go to Photoshop (ALWAYS_PROPAGATE)
        var guidePolicyList = visibleGuides.map(function (guide) {
            var horizontal = guide.orientation === "horizontal",
                guideTL = uiStore.transformCanvasToWindow(
                    horizontal ? 0 : guide.position,
                    horizontal ? guide.position : 0
                ),
                guideArea;

            if (horizontal) {
                guideArea = {
                    x: canvasBounds.left,
                    y: Math.floor(guideTL.y - policyThickness - 1),
                    width: canvasBounds.right - canvasBounds.left,
                    height: Math.ceil(policyThickness * 2 + 1)
                };
            } else {
                guideArea = {
                    x: Math.floor(guideTL.x - policyThickness - 1),
                    y: canvasBounds.top,
                    width: Math.ceil(policyThickness * 2 + 1),
                    height: canvasBounds.bottom - canvasBounds.top
                };
            }
            
            return new PointerEventPolicy(adapterUI.policyAction.ALWAYS_PROPAGATE,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                {}, // no modifiers
                guideArea);
        }).toArray();

        _currentGuidePolicyID = null;

        return removePromise
            .bind(this)
            .then(function () {
                return this.transfer(policy.addPointerPolicies, guidePolicyList);
            }).then(function (policyID) {
                _currentGuidePolicyID = policyID;
            });
    };
    resetGuidePolicies.reads = [locks.JS_APP, locks.JS_DOC, locks.JS_TOOL, locks.JS_UI];
    resetGuidePolicies.writes = [];
    resetGuidePolicies.transfers = [policy.removePointerPolicies, policy.addPointerPolicies];

    /**
     * Creates a guide and starts tracking it for user to place in desired location
     *
     * @param {Document} doc 
     * @param {string} orientation "horizontal" or "vertical"
     * @param {number} x Mouse down location
     * @param {number} y Mouse down location
     *
     * @return {Promise}
     */
    var createGuideAndTrack = function (doc, orientation, x, y) {
        var docRef = documentLib.referenceBy.id(doc.id),
            uiStore = this.flux.store("ui"),
            canvasXY = uiStore.transformWindowToCanvas(x, y),
            horizontal = orientation === "horizontal",
            position = horizontal ? canvasXY.y : canvasXY.x,
            topAncestors = doc.layers.selectedTopAncestors,
            artboardGuide = topAncestors.size === 1 && topAncestors.first().isArtboard,
            createObj = documentLib.insertGuide(docRef, orientation, position, artboardGuide);

        return descriptor.playObject(createObj)
            .then(function () {
                var eventKind = adapterOS.eventKind.LEFT_MOUSE_DOWN,
                    coordinates = [x, y];
                        
                return adapterOS.postEvent({ eventKind: eventKind, location: coordinates });
            });
    };
    createGuideAndTrack.reads = [locks.JS_UI];
    createGuideAndTrack.writes = [locks.JS_DOC];

    /**
     * Helper function to figure out whether the guide with the
     * given position and orientation is within the visible canvas bounds
     *
     * @private
     * @param {string} orientation "horizontal" or "vertical"
     * @param {number} position
     * @return {boolean} True if guide is within the canvas bounds
     */
    var _guideWithinVisibleCanvas = function (orientation, position) {
        var uiStore = this.flux.store("ui"),
            cloakRect = uiStore.getCloakRect(),
            horizontal = orientation === "horizontal",
            x = horizontal ? 0 : position,
            y = horizontal ? position : 0,
            windowPos = uiStore.transformCanvasToWindow(x, y);

        if (horizontal &&
            (windowPos.y < cloakRect.top || windowPos.y > cloakRect.bottom)) {
            return false;
        } else if (!horizontal &&
            (windowPos.x < cloakRect.left || windowPos.x > cloakRect.right)) {
            return false;
        } else {
            return true;
        }
    };

    /**
     * Deletes the given guide
     *
     * @param {{id: number}} document Document model or object containing document ID
     * @param {number} index Index of the guide to be deleted
     * @param {object} options
     * @param {boolean=} options.sendChanges If true, will call the action descriptor to delete the guide from PS
     *
     * @return {Promise}
     */
    var deleteGuide = function (document, index, options) {
        var removePromise = Promise.resolve();

        if (options.sendChanges) {
            var docRef = documentLib.referenceBy.id(document.id),
                removeObj = documentLib.removeGuide(docRef, index + 1);

            removePromise = descriptor.playObject(removeObj);
        }

        var payload = {
            documentID: document.id,
            index: index
        };

        return removePromise
            .bind(this)
            .then(function () {
                return this.dispatchAsync(events.document.history.nonOptimistic.GUIDE_DELETED, payload);
            })
            .then(function () {
                return this.transfer(resetGuidePolicies);
            });
    };
    deleteGuide.reads = [];
    deleteGuide.writes = [locks.JS_DOC];
    deleteGuide.transfers = [resetGuidePolicies];

    /**
     * Updates the given guide's position or creates a new guide if necessary
     * If the guide is dragged outside the visible canvas, will delete it
     *
     * @param {{id: number}} document Document model or an object containing document ID
     * @param {Guide} guide Guide model to be set/created
     * @param {number} index Index of the edited guide
     * @return {Promise}
     */
    var setGuide = function (document, guide, index) {
        var guideWithinBounds = _guideWithinVisibleCanvas.call(this, guide.orientation, guide.position);

        if (!guideWithinBounds) {
            return this.transfer(deleteGuide, document, index, { sendChanges: true });
        }

        var payload = {
            documentID: document.id,
            guide: guide,
            index: index
        };

        return this.dispatchAsync(events.document.history.nonOptimistic.GUIDE_SET, payload)
            .bind(this)
            .then(function () {
                return this.transfer(resetGuidePolicies);
            });
    };
    setGuide.reads = [];
    setGuide.writes = [locks.JS_DOC];
    setGuide.transfers = [resetGuidePolicies, deleteGuide];

    /**
     * Clears all the guides in the given document
     *
     * @param {Document=} document Document model
     * @return {Promise}
     */
    var clearGuides = function (document) {
        if (document === undefined) {
            var appStore = this.flux.store("application");

            document = appStore.getCurrentDocument();
        }

        var payload = {
                documentID: document.id
            },
            clearObj = documentLib.clearGuides(documentLib.referenceBy.id(document.id)),
            dispatchPromise = this.dispatchAsync(events.document.history.nonOptimistic.GUIDES_CLEARED, payload),
            clearPromise = descriptor.playObject(clearObj);

        return Promise.join(dispatchPromise, clearPromise)
            .bind(this)
            .then(function () {
                return this.transfer(resetGuidePolicies);
            });
    };
    clearGuides.reads = [];
    clearGuides.writes = [locks.JS_DOC, locks.PS_DOC];
    clearGuides.transfers = [resetGuidePolicies];

    /**
     * Re-gets the guides of the given document and rebuilds the models
     *
     * @param {Document=} document Default is active document
     * @return {Promise}
     */
    var queryCurrentGuides = function (document) {
        var appStore = this.flux.store("application");

        if (document === undefined) {
            document = appStore.getCurrentDocument();
        }
        
        var docRef = documentLib.referenceBy.id(document.id);

        return _getGuidesForDocumentRef(docRef)
            .bind(this)
            .then(function (guides) {
                var payload = {
                    document: document,
                    guides: guides
                };

                return this.dispatch(events.document.GUIDES_UPDATED, payload);
            });
    };
    queryCurrentGuides.reads = [locks.PS_DOC];
    queryCurrentGuides.writes = [locks.JS_DOC];

    // Event handlers for guides
    var _guideSetHandler = null,
        _guideDeleteHandler = null;

    /**
     * Register event listeners for guide edit/delete events
     * 
     * @return {Promise}
     */
    var beforeStartup = function () {
        // Listen for guide set events
        _guideSetHandler = function (event) {
            var target = objUtil.getPath(event, "null._ref");

            if (target && _.isArray(target) && target.length === 2 &&
                target[0]._ref === "document" && target[1]._ref === "good") {
                var documentID = target[0]._id,
                    document = this.flux.store("document").getDocument(documentID),
                    mockGuide = {
                        layerID: event.layerID,
                        orientation: event.orientation._value,
                        position: event.position._value,
                        isDocumentGuide: event.kind._value === "document"
                    },
                    index = target[1]._index - 1; // PS indices guides starting at 1
                
                this.flux.actions.guides.setGuide(document, mockGuide, index);
            }
        }.bind(this);
        descriptor.addListener("set", _guideSetHandler);

        // Listen for guide delete events
        _guideDeleteHandler = function (event) {
            var target = objUtil.getPath(event, "null._ref");

            // Mind the reversal of references compared to "set"
            if (target && _.isArray(target) && target.length === 2 &&
                target[1]._ref === "document" && target[0]._ref === "good") {
                var documentID = target[1]._id,
                    document = this.flux.store("document").getDocument(documentID),
                    index = target[0]._index - 1; // PS indices guides starting at 1

                this.flux.actions.guides.deleteGuide(document, index, { sendChanges: false });
            }
        }.bind(this);
        descriptor.addListener("delete", _guideDeleteHandler);

        return Promise.resolve();
    };
    beforeStartup.modal = true;
    beforeStartup.reads = [];
    beforeStartup.writes = [];
    beforeStartup.transfers = [];
    
    /**
     * Remove event handlers.
     *
     * @return {Promise}
     */
    var onReset = function () {
        descriptor.removeListener("set", _guideSetHandler);
        descriptor.removeListener("delete", _guideDeleteHandler);

        return Promise.resolve();
    };
    onReset.reads = [];
    onReset.writes = [];

    exports._getGuidesForDocumentRef = _getGuidesForDocumentRef;

    exports.createGuideAndTrack = createGuideAndTrack;
    exports.setGuide = setGuide;
    exports.deleteGuide = deleteGuide;
    exports.resetGuidePolicies = resetGuidePolicies;
    exports.queryCurrentGuides = queryCurrentGuides;
    exports.clearGuides = clearGuides;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
