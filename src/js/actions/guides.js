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
        adapterUI = require("adapter/ps/ui"),
        adapterOS = require("adapter/os");

    var locks = require("js/locks"),
        events = require("js/events"),
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
        "itemIndex"
    ];

    /**
     * Get all the guide descriptors in the given document.
     * 
     * @private
     * @param {object} docRef A document reference
     * @param {number} numberOfGuides
     * @return {Promise.<Array.<object>>}
     */
    var _getGuidesForDocumentRef = function (docRef, numberOfGuides) {
        var rangeOpts = {
                range: "guide",
                index: 1,
                count: numberOfGuides
            },
            getOpts = {
                failOnMissingProperty: true
            };

        // FIXME: Should we reverse these?
        return descriptor.getPropertiesRange(docRef, rangeOpts, _guideProperties, getOpts);
    };

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
            currentTool = toolStore.getCurrentTool();

        // Make sure to always remove the remaining policies
        if (!currentDocument || !currentTool || currentTool.id !== "newSelect") {
            if (currentPolicy) {
                _currentGuidePolicyID = null;
                return this.transfer(policy.removePointerPolicies,
                    currentPolicy, true);
            } else {
                return Promise.resolve();
            }
        }

        var guides = currentDocument.guides;

        // If selection is empty, remove existing policy
        if (!guides || guides.empty) {
            if (currentPolicy) {
                _currentGuidePolicyID = null;
                return this.transfer(policy.removePointerPolicies,
                    currentPolicy, true);
            } else {
                return Promise.resolve();
            }
        }

        // How thick the policy line should be while defined as an area around the guide
        var policyThickness = 2,
            canvasBounds = uiStore.getCloakRect();

        // Each guide is either horizontal or vertical with a specific position on canvas space
        // We need to create a rectangle around this guide that fits the window boundaries
        // that lets the mouse clicks go to Photoshop (ALWAYS_PROPAGATE)
        var guidePolicyList = guides.map(function (guide) {
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

        var removePromise;
        if (currentPolicy) {
            _currentGuidePolicyID = null;
            removePromise = this.transfer(policy.removePointerPolicies,
                currentPolicy, false);
        } else {
            removePromise = Promise.resolve();
        }

        return removePromise.bind(this).then(function () {
            return this.transfer(policy.addPointerPolicies, guidePolicyList);
        }).then(function (policyID) {
            _currentGuidePolicyID = policyID;
        });
    };
    resetGuidePolicies.reads = [locks.JS_APP, locks.JS_DOC, locks.JS_TOOL, locks.JS_UI];
    resetGuidePolicies.writes = [];
    resetGuidePolicies.transfers = [policy.removePointerPolicies, policy.addPointerPolicies];

    /**
     * Updates the given guide's position
     *
     * @param {object} payload
     * @param {number} payload.documentID Owner document ID
     * @param {number} payload.index Index of the edited guide
     * @param {string} payload.orientation New orientation of the guide
     * @param {number} payload.position New position of the guide
     *
     * @return {Promise}
     */
    var moveGuide = function (payload) {
        return this.dispatchAsync(events.document.history.nonOptimistic.GUIDE_MOVED, payload)
            .bind(this)
            .then(function () {
                return this.transfer(resetGuidePolicies);
            });
    };
    moveGuide.reads = [];
    moveGuide.writes = [locks.JS_DOC];
    moveGuide.transfers = [resetGuidePolicies];

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
            var target = event.null._ref;

            if (_.isArray(target) && target[0]._ref === "document" && target[1]._ref === "good") {
                var payload = {
                    documentID: target[0]._id,
                    index: target[1]._index - 1, // PS indices guides starting at 1
                    orientation: event.orientation._value,
                    position: event.position._value
                };

                this.flux.actions.guides.moveGuide(payload);
            }
        }.bind(this);
        descriptor.addListener("set", _guideSetHandler);

        // Listen for guide delete events
        _guideDeleteHandler = function (event) {
            var target = event.null._ref;

            // Mind the reversal of references compared to "set"
            if (_.isArray(target) && target[1]._ref === "document" && target[0]._ref === "good") {
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

    exports.moveGuide = moveGuide;
    exports.deleteGuide = deleteGuide;
    exports.resetGuidePolicies = resetGuidePolicies;


    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
