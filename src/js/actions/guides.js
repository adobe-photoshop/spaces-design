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
            },
            getOpts = {
                failOnMissingProperty: true
            };

        // FIXME: Should we reverse these?
        return descriptor.getPropertiesRange(docRef, rangeOpts, _guideProperties, getOpts);
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
                return guide.layerID === 0 || topAncestorIDs.has(guide.layerID);
            });

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
                    y: guideTL.y - policyThickness - 1,
                    width: canvasBounds.right - canvasBounds.left,
                    height: policyThickness * 2 + 1
                };
            } else {
                guideArea = {
                    x: guideTL.x - policyThickness,
                    y: canvasBounds.top,
                    width: policyThickness * 2 + 1,
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
     * Updates the given guide's position or creates a new guide if necessary
     *
     * @param {object} payload
     * @param {number} payload.documentID Owner document ID
     * @param {number} payload.index Index of the edited guide
     * @param {string} payload.orientation New orientation of the guide
     * @param {number} payload.position New position of the guide
     *
     * @return {Promise}
     */
    var setGuide = function (payload) {
        return this.dispatchAsync(events.document.history.nonOptimistic.GUIDE_SET, payload)
            .bind(this)
            .then(function () {
                return this.transfer(resetGuidePolicies);
            });
    };
    setGuide.reads = [];
    setGuide.writes = [locks.JS_DOC];
    setGuide.transfers = [resetGuidePolicies];

    /**
     * Deletes the given guide
     *
     * @param {object} payload
     * @param {number} payload.documentID Owner document ID
     * @param {number} payload.index Index of the edited guide
     *
     * @return {Promise}
     */
    var deleteGuide = function (payload) {
        return this.dispatchAsync(events.document.history.nonOptimistic.GUIDE_DELETED, payload)
            .bind(this)
            .then(function () {
                return this.transfer(resetGuidePolicies);
            });
    };
    deleteGuide.reads = [];
    deleteGuide.writes = [locks.JS_DOC];
    deleteGuide.transfers = [resetGuidePolicies];

    var queryCurrentGuides = function (document) {
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
                var payload = {
                    documentID: target[0]._id,
                    layerID: event.layerID,
                    index: target[1]._index - 1, // PS indices guides starting at 1
                    orientation: event.orientation._value,
                    position: event.position._value
                };

                this.flux.actions.guides.setGuide(payload);
            }
        }.bind(this);
        descriptor.addListener("set", _guideSetHandler);

        // Listen for guide delete events
        _guideDeleteHandler = function (event) {
            var target = objUtil.getPath(event, "null._ref");

            // Mind the reversal of references compared to "set"
            if (target && _.isArray(target) && target.length === 2 &&
                target[1]._ref === "document" && target[0]._ref === "good") {
                var payload = {
                    documentID: target[1]._id,
                    index: target[0]._index - 1 // PS indices guides starting at 1
                };

                this.flux.actions.guides.deleteGuide(payload);
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


    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
