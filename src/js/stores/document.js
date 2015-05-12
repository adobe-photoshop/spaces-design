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
        Immutable = require("immutable"),
        _ = require("lodash");

    var Document = require("../models/document"),
        events = require("../events");

    var DocumentStore = Fluxxor.createStore({

        /**
         * @type {Object.<number, Document>}
         */
        _openDocuments: null,

        initialize: function () {
            this.bindActions(
                events.RESET, this._handleReset,
                events.document.DOCUMENT_UPDATED, this._documentUpdated,
                events.document.SAVE_DOCUMENT, this._handleDocumentSaved,
                events.document.DOCUMENT_RENAMED, this._handleDocumentRenamed,
                events.document.CLOSE_DOCUMENT, this._closeDocument,
                events.document.history.nonOptimistic.ADD_LAYERS, this._handleLayerAdd,
                events.document.GUIDES_VISIBILITY_CHANGED, this._updateDocumentGuidesVisibility,
                events.document.RESET_LAYERS, this._handleLayerReset,
                events.document.RESET_LAYERS_BY_INDEX, this._handleLayerResetByIndex,
                events.document.history.nonOptimistic.RESET_BOUNDS, this._handleBoundsReset,
                events.document.RESET_BOUNDS, this._handleBoundsReset,
                events.document.history.optimistic.REORDER_LAYERS, this._handleLayerReorder,
                events.document.history.amendment.REORDER_LAYERS, this._handleLayerReorder,
                events.document.REORDER_LAYERS, this._handleLayerReorder,
                events.document.SELECT_LAYERS_BY_ID, this._handleLayerSelectByID,
                events.document.SELECT_LAYERS_BY_INDEX, this._handleLayerSelectByIndex,
                events.document.VISIBILITY_CHANGED, this._handleVisibilityChanged,
                events.document.history.optimistic.LOCK_CHANGED, this._handleLockChanged,
                events.document.SET_GROUP_EXPANSION, this._handleGroupExpansion,
                events.document.history.optimistic.OPACITY_CHANGED, this._handleOpacityChanged,
                events.document.history.optimistic.BLEND_MODE_CHANGED, this._handleBlendModeChanged,
                events.document.history.optimistic.RENAME_LAYER, this._handleLayerRenamed,
                events.document.history.optimistic.DELETE_LAYERS, this._handleDeleteLayers,
                events.document.history.nonOptimistic.DELETE_LAYERS, this._handleDeleteLayers,
                events.document.DELETE_LAYERS_NO_HISTORY, this._handleDeleteLayers,
                events.document.history.optimistic.GROUP_SELECTED, this._handleGroupLayers,
                events.document.history.nonOptimistic.UNGROUP_SELECTED, this._handleUngroupLayers,
                events.document.history.optimistic.REPOSITION_LAYERS, this._handleLayerRepositioned,
                events.document.TRANSLATE_LAYERS, this._handleLayerTranslated,
                events.document.history.optimistic.RESIZE_LAYERS, this._handleLayerResized,
                events.document.history.optimistic.SET_LAYERS_PROPORTIONAL, this._handleSetLayersProportional,
                events.document.history.optimistic.RESIZE_DOCUMENT, this._handleDocumentResized,
                events.document.LAYER_BOUNDS_CHANGED, this._handleLayerBoundsChanged,
                events.document.history.optimistic.RADII_CHANGED, this._handleRadiiChanged,
                events.document.history.optimistic.FILL_COLOR_CHANGED, this._handleFillPropertiesChanged,
                events.document.history.optimistic.FILL_OPACITY_CHANGED, this._handleFillPropertiesChanged,
                events.document.history.optimistic.FILL_ADDED, this._handleFillAdded,
                events.document.STROKE_ALIGNMENT_CHANGED, this._handleStrokePropertiesChanged,
                events.document.STROKE_ENABLED_CHANGED, this._handleStrokePropertiesChanged,
                events.document.STROKE_WIDTH_CHANGED, this._handleStrokePropertiesChanged,
                events.document.history.optimistic.STROKE_COLOR_CHANGED, this._handleStrokePropertiesChanged,
                events.document.history.optimistic.STROKE_OPACITY_CHANGED, this._handleStrokePropertiesChanged,
                events.document.history.nonOptimistic.STROKE_ADDED, this._handleStrokeAdded,
                events.document.history.optimistic.LAYER_EFFECT_CHANGED, this._handleLayerEffectPropertiesChanged,
                events.document.history.optimistic.LAYER_EFFECT_DELETED, this._handleDeletedLayerEffect,
                events.document.TYPE_FACE_CHANGED, this._handleTypeFaceChanged,
                events.document.TYPE_SIZE_CHANGED, this._handleTypeSizeChanged,
                events.document.history.optimistic.TYPE_COLOR_CHANGED, this._handleTypeColorChanged,
                events.document.TYPE_TRACKING_CHANGED, this._handleTypeTrackingChanged,
                events.document.TYPE_LEADING_CHANGED, this._handleTypeLeadingChanged,
                events.document.TYPE_ALIGNMENT_CHANGED, this._handleTypeAlignmentChanged
            );

            this._handleReset();
        },

        /**
         * Reset or initialize store state.
         *
         * @private
         */
        _handleReset: function () {
            this._openDocuments = {};
        },

        /**
         * Returns all open documents
         *
         * @return {Iterable.<?Document>}
         */
        getAllDocuments: function () {
            return this._openDocuments;
        },

        /**
         * Returns the document with the given ID; or null if there is none
         *
         * @param {number} id Document ID
         * @return {?Document}
         */
        getDocument: function (id) {
            return this._openDocuments[id] || null;
        },

        /**
         * Construct a document model from a document and array of layer descriptors.
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} docObj
         * @return {Document}
         */
        _makeDocument: function (docObj) {
            var rawDocument = docObj.document,
                rawLayers = docObj.layers;

            return Document.fromDescriptors(rawDocument, rawLayers);
        },

        /**
         * Set a new document model, optionally setting the dirty flag if the
         * model has changed, and emit a change event.
         *
         * @param {Document} nextDocument
         * @param {boolean=} dirty Whether to set the dirty bit, assuming the model has changed
         */
        setDocument: function (nextDocument, dirty) {
            var oldDocument = this._openDocuments[nextDocument.id];
            if (Immutable.is(oldDocument, nextDocument)) {
                return;
            }

            if (dirty) {
                nextDocument = nextDocument.set("dirty", true);
            }

            this._openDocuments[nextDocument.id] = nextDocument;
            this.emit("change");
        },

        /**
         * Reset a single document model from the given document and layer descriptors.
         *
         * @private
         * @param {{document: object, layers: Array.<object>}} payload
         */
        _documentUpdated: function (payload) {
            var doc = this._makeDocument(payload);

            this.setDocument(doc);
        },

        /**
         * Remove a single document model for the given document ID
         *
         * @private
         * @param {{documentID: number} payload
         */
        _closeDocument: function (payload) {
            var documentID = payload.documentID;

            delete this._openDocuments[documentID];
            this.emit("change");
        },

        /**
         * Unset the dirty bit on the document.
         *
         * @private
         * @param {{documentID: number}} payload
         */
        _handleDocumentSaved: function (payload) {
            var documentID = payload.documentID,
                document = this._openDocuments[documentID];

            this._openDocuments[documentID] = document.set("dirty", false);
            this.emit("change");
        },

        /**
         * Rename the document for the given document ID.
         *
         * @private
         * @param {{documentID: number, name: string}} payload
         */
        _handleDocumentRenamed: function (payload) {
            var documentID = payload.documentID,
                updatedModel = {
                    name: payload.name,
                    format: payload.format
                },
                document = this._openDocuments[documentID],
                nextDocument = document.merge(updatedModel);

            this.setDocument(nextDocument);
        },

        /**
         * Update the bounds of the document
         *
         * @private
         * @param {{documentID: number, size: {w: number, h: number}}} payload
         */
        _handleDocumentResized: function (payload) {
            var documentID = payload.documentID,
                size = payload.size,
                document = this._openDocuments[documentID],
                nextDocument = document.resize(size.w, size.h);

            this.setDocument(nextDocument, true);
        },

        /**
         * Create and add a new layer model, possibly replacing an existing layer model.
         *
         * @private
         * @param {object} payload An object with the following properties:
         *  {
         *      documentID: number,
         *      layerID: Array.<number>,
         *      descriptor: Array.<object>,
         *      selected: boolean,
         *      replace: boolean || number
         *  }
         */
        _handleLayerAdd: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                descriptors = payload.descriptors,
                selected = payload.selected,
                replace = payload.replace,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.addLayers(layerIDs, descriptors, selected, replace, document),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update the visibility of a document's guides or smart guides
         *
         * @private
         * @param {{documentID: number, guidesVisible: boolean, smartGuidesVisible: boolean=}} payload
         */
        _updateDocumentGuidesVisibility: function (payload) {
            var documentID = payload.documentID,
                props = _.pick(payload, ["guidesVisible", "smartGuidesVisible"]),
                document = this._openDocuments[documentID],
                nextDocument = document.merge(props);

            this.setDocument(nextDocument, true);
        },

        /**
         * Reset the given layer models.
         *
         * @private
         * @param {{documentID: number, layers: Immutable.Iterable.<{layerID: number, descriptor: object}>} payload
         */
        _handleLayerReset: function (payload) {
            var documentID = payload.documentID,
                layerObjs = payload.layers,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.resetLayers(layerObjs, document),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Reset the given layer bounds models.
         *
         * @private
         * @param {{documentID: number, layers: Immutable.Iterable.<{layerID: number, descriptor: object}>} payload
         */
        _handleBoundsReset: function (payload) {
            var documentID = payload.documentID,
                boundsObjs = payload.bounds,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.resetBounds(boundsObjs),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Reset the given layer models based on index in the tree
         *
         * @private
         * @param {{documentID: number, descriptors: Array.<ActionDescriptor>}} payload
         */
        _handleLayerResetByIndex: function (payload) {
            var documentID = payload.documentID,
                descriptors = payload.descriptors,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.replaceLayersByIndex(document, descriptors),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update basic properties (e.g., name, opacity, etc.) of the given layers.
         *
         * @private
         * @param {number} documentID
         * @param {Immutable.List.<number>} layerIDs
         * @param {object} properties
         */
        _updateLayerProperties: function (documentID, layerIDs, properties) {
            var document = this._openDocuments[documentID],
                nextLayers = document.layers.setProperties(layerIDs, properties),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * When a layer visibility is toggled, updates the layer object.
         *
         * @private
         * @param {{documentID: number, layerID: number, visible: boolean}} payload
         */
        _handleVisibilityChanged: function (payload) {
            var documentID = payload.documentID,
                layerID = payload.layerID,
                layerIDs = Immutable.List.of(layerID),
                visible = payload.visible;

            this._updateLayerProperties(documentID, layerIDs, { visible: visible });
        },

        /**
         * When a layer locking is changed, updates the corresponding layer object
         *
         * @private
         * @param {{documentID: number, layerID: number, locked: boolean}} payload
         */
        _handleLockChanged: function (payload) {
            var documentID = payload.documentID,
                layerID = payload.layerID,
                layerIDs = Immutable.List.of(layerID),
                locked = payload.locked;

            this._updateLayerProperties(documentID, layerIDs, { locked: locked });
        },

        /**
         * Update layer models when groups are expanded or collapsed.
         *
         * @private
         * @param {{documentID: number, layerIDs: Immutable.Iterable.<number>, expanded: boolean}} payload
         */
        _handleGroupExpansion: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                expanded = payload.expanded;

            this._updateLayerProperties(documentID, layerIDs, { expanded: expanded });
        },

        /**
         * Update the layer opacity, as a percentage in [0, 100].
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, opacity: number}} payload
         */
        _handleOpacityChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                opacity = payload.opacity;

            this._updateLayerProperties(documentID, layerIDs, { opacity: opacity });
        },

        /**
         * Update the layer blendMode.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, mode: string}} payload
         */
        _handleBlendModeChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                mode = payload.mode;

            this._updateLayerProperties(documentID, layerIDs, { blendMode: mode });
        },


        /**
         * Rename the given layer in the given document.
         *
         * @private
         * @param {{documentID: number, layerID: number, newName: string}} payload
         */
        _handleLayerRenamed: function (payload) {
            var documentID = payload.documentID,
                layerID = payload.layerID,
                layerIDs = Immutable.List.of(layerID),
                name = payload.name;

            this._updateLayerProperties(documentID, layerIDs, { name: name });
        },

        /**
         * Remove the deleted layers from our model and update the order
         *
         * @private
         * @param {{documentID: number, layerIDs: Immutable.List<number>, selectedIndices: Array.<number>=}} payload
         */
        _handleDeleteLayers: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                document = this._openDocuments[documentID],
                updatedLayers = document.layers.deleteLayers(layerIDs),
                nextDocument = document.set("layers", updatedLayers);

            this.setDocument(nextDocument, true);

            if (payload.selectedIndices) {
                this._updateLayerSelectionByIndices(nextDocument, Immutable.Set(payload.selectedIndices));
            }
        },

        /**
         * Create a new group layer in the given document that contains the
         * currently selected layers.
         *
         * @private
         */
        _handleGroupLayers: function (payload) {
            var documentID = payload.documentID,
                groupID = payload.groupID,
                groupEndID = payload.groupEndID,
                groupName = payload.groupname;

            var document = this._openDocuments[documentID],
                updatedLayers = document.layers.createGroup(documentID, groupID, groupEndID, groupName),
                nextDocument = document.set("layers", updatedLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Payload contains the array of layer IDs after reordering,
         * Sends it to layertree model to rebuild the tree
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>}} payload
         *
         */
        _handleUngroupLayers: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                selectedIDs = payload.selectedIDs,
                document = this._openDocuments[documentID],
                reorderedLayers = document.layers.updateOrder(layerIDs),
                selectedLayers = reorderedLayers.updateSelection(selectedIDs),
                nextDocument = document.set("layers", selectedLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Payload contains the array of layer IDs after reordering, and the selected indexes
         * Sends it to layertree model to rebuild the tree
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, selectedIndices: Array.<number>}} payload
         *
         */
        _handleLayerReorder: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                document = this._openDocuments[documentID],
                reorderLayers = document.layers.updateOrder(layerIDs),
                selectedIDs = Immutable.Set(payload.selectedIndices.map(function (index) {
                    return reorderLayers.byIndex(index + 1).id;
                })),
                nextLayers = reorderLayers.updateSelection(selectedIDs),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Helper function to change layer selection given a Set of selected IDs.
         *
         * @private
         * @param {Document} document
         * @param {Immutable.Set<number>} selectedIDs
         */
        _updateLayerSelection: function (document, selectedIDs) {
            var nextLayers = document.layers.updateSelection(selectedIDs),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Helper function to change layer selection given a Set of selected indexes.
         *
         * @private
         * @param {Document} document
         * @param {Immutable.Set<number>} selectedIndices
         */
        _updateLayerSelectionByIndices: function (document, selectedIndices) {
            var selectedIDs = selectedIndices.map(function (index) {
                    return document.layers.byIndex(index + 1).id;
                });

            this._updateLayerSelection(document, selectedIDs);
        },

        /**
         * Update selection state of layer models, referenced by id.
         *
         * @private
         * @param {{documentID: number, selectedIDs: Array.<number>}} payload
         */
        _handleLayerSelectByID: function (payload) {
            var document = this._openDocuments[payload.documentID],
                selectedIDs = Immutable.Set(payload.selectedIDs);

            this._updateLayerSelection(document, selectedIDs);
        },

        /**
         * Update selection state of layer models, referenced by index.
         *
         * @private
         * @param {{documentID: number, selectedIndices: Array.<number>}} payload
         */
        _handleLayerSelectByIndex: function (payload) {
            var document = this._openDocuments[payload.documentID],
                selectedIndices = Immutable.Set(payload.selectedIndices);

            this._updateLayerSelectionByIndices(document, selectedIndices);
        },

        /**
         * Update the bounds of affected layers
         *
         * @private
         * @param {{documentID: number, positions: Array.<{layer: Layer, x: number, y: number}>}} payload
         */
        _handleLayerRepositioned: function (payload) {
            var documentID = payload.documentID,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.repositionLayers(payload.positions),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Updates the passed in translation to affected layers
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, change: {x: number, y: number}}} payload
         */
        _handleLayerTranslated: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                position = payload.position,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.translateLayers(layerIDs, position.x, position.y),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update the bounds of affected layers
         *
         * @private
         * @param {{documentID: number, sizes: object}} payload
         * @param {Array.<{layer: Layer, w: number, h: number, x: number, y: number}>} payload.sizes
         */
        _handleLayerResized: function (payload) {
            var documentID = payload.documentID,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.resizeLayers(payload.sizes),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update the bounds of affected layers: left, top, width, height
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, size: object, position: object}} payload
         */
        _handleLayerBoundsChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                size = payload.size,
                position = payload.position,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.updateBounds(layerIDs, position.left, position.top, size.w, size.h),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update the proportional flag of affected layers
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, propotional: bool} payload
         */
        _handleSetLayersProportional: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                proportional = payload.proportional,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setLayersProportional(layerIDs, proportional),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Set the radii for the given layers in the given document.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, radii: object}} payload
         */
        _handleRadiiChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                radii = payload.radii,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setBorderRadii(layerIDs, radii),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update the provided properties of all fills of given index of the given layers of the given document
         * example payload {documentID:1, layerIDs:[1,2], fillIndex: 0, fillProperties:{opacity:1}}
         *
         * expects payload like
         *     {
         *         documentID: number,
         *         layerIDs: Array.<number>,
         *         fillIndex: number,
         *         fillProperties: object
         *     }
         *
         * @private
         * @param {object} payload
         */
        _handleFillPropertiesChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                fillIndex = payload.fillIndex,
                fillProperties = payload.fillProperties,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setFillProperties(layerIDs, fillIndex, fillProperties),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Adds a fill to the specified document and layers
         *
         * @private
         * @param {{!color: object, !type: string, enabled: boolean}} payload
         */
        _handleFillAdded: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                setDescriptor = payload.setDescriptor,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.addFill(layerIDs, setDescriptor),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update the provided properties of all strokes of given index of the given layers of the given document
         * example payload {documentID:1, layerIDs:[1,2], strokeIndex: 0, strokeProperties:{width:12}}
         *
         * expects payload like
         *     {
         *         documentID: number,
         *         layerIDs: Array.<number>,
         *         strokeIndex: number,
         *         strokeProperties: object
         *     }
         *
         * @private
         * @param {object} payload
         */
        _handleStrokePropertiesChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                strokeIndex = payload.strokeIndex,
                strokeProperties = payload.strokeProperties,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setStrokeProperties(layerIDs, strokeIndex, strokeProperties),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Adds a stroke to the specified document and layers
         * This also handles updating strokes where we're refetching from Ps
         *
         * @private
         * @param {{documentID: !number, layerStrokes: {layerID: number, strokeStyleDescriptor: object}} payload
         */
        _handleStrokeAdded: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                strokeIndex = payload.strokeIndex,
                strokeStyleDescriptor = payload.strokeStyleDescriptor,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.addStroke(layerIDs, strokeIndex, strokeStyleDescriptor),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update the provided properties of all layer effects of given index of the given layers of the given document
         *
         * example payload:
         * {
         *     documentID: 1,
         *     layerIDs:[ 1,2],
         *     layerEffectIndex: 0,
         *     layerEffectType: "dropShadow",
         *     layerEffectProperties: {blur: 12}
         * }
         *
         * @private
         * @param {object} payload
         */
        _handleLayerEffectPropertiesChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                layerEffectIndex = payload.layerEffectIndex,
                layerEffectType = payload.layerEffectType,
                layerEffectProperties = payload.layerEffectProperties,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setLayerEffectProperties(
                    layerIDs, layerEffectIndex, layerEffectType, layerEffectProperties),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },


        /**
         * Delete the selected layer effects of selected layers of the given document
         *
         * example payload:
         * {
         *     documentID: 1,
         *     layerIDs:[ 1,2],
         *     layerEffectIndex: 0,
         *     layerEffectType: "dropShadow",
         * }
         *
         * @private
         * @param {object} payload
         */
        _handleDeletedLayerEffect: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                layerEffectIndex = payload.layerEffectIndex,
                layerEffectType = payload.layerEffectType,
                document = this._openDocuments[documentID];

            var nextLayers = document.layers.deleteLayerEffectProperties(layerIDs, layerEffectIndex, layerEffectType),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update text styles when the typeface used in text layers changes.
         * NOTE: Assumes that each layer now only has a single text style,
         * and adjusts the model accordingly.
         *
         * example payload:
         * {
         *     documentID: number,
         *     layerIDs: Array.<number>,
         *     family: string,
         *     style: string,
         *     postcript: string
         * }
         *
         * @private
         * @param {object} payload
         */
        _handleTypeFaceChanged: function (payload) {
            var family = payload.family,
                style = payload.style,
                fontStore = this.flux.store("font"),
                postScriptName = fontStore.getPostScriptFromFamilyStyle(family, style);

            if (!postScriptName) {
                postScriptName = payload.postscript;
            }

            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setCharacterStyleProperties(layerIDs, { postScriptName: postScriptName }),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update text styles when the type size used in text layers changes.
         * NOTE: Assumes that each layer now only has a single text style,
         * and adjusts the model accordingly.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, size: number}} payload
         */
        _handleTypeSizeChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                size = payload.size,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setCharacterStyleProperties(layerIDs, { textSize: size }),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update text styles when the type color used in text layers changes.
         * NOTE: Assumes that each layer now only has a single text style,
         * and adjusts the model accordingly.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, color: Color|null}} payload
         */
        _handleTypeColorChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                color = payload.color,
                opaqueColor = null,
                opacity = null,
                document = this._openDocuments[documentID];
            if (color !== null) {
                opaqueColor = color.opaque();
                opacity = color.opacity;
            }
            var nextLayers = document.layers
                    .setCharacterStyleProperties(layerIDs, { color: opaqueColor })
                    .setProperties(layerIDs, { opacity: opacity }),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update text styles when the type tracking used in text layers changes.
         * NOTE: Assumes that each layer now only has a single text style,
         * and adjusts the model accordingly.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, tracking: number}} payload
         */
        _handleTypeTrackingChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                tracking = payload.tracking,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setCharacterStyleProperties(layerIDs, { tracking: tracking }),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update text styles when the type leading used in text layers changes.
         * NOTE: Assumes that each layer now only has a single text style,
         * and adjusts the model accordingly.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, leading: number}} payload
         */
        _handleTypeLeadingChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                leading = payload.leading,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setCharacterStyleProperties(layerIDs, { leading: leading }),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        },

        /**
         * Update paragraph styles when the alignment used in text layers changes.
         * NOTE: Assumes that each layer now only has a single text style,
         * and adjusts the model accordingly.
         *
         * @private
         * @param {{documentID: number, layerIDs: Array.<number>, alignment: string}} payload
         */
        _handleTypeAlignmentChanged: function (payload) {
            var documentID = payload.documentID,
                layerIDs = payload.layerIDs,
                alignment = payload.alignment,
                document = this._openDocuments[documentID],
                nextLayers = document.layers.setParagraphStyleProperties(layerIDs, { alignment: alignment }),
                nextDocument = document.set("layers", nextLayers);

            this.setDocument(nextDocument, true);
        }
    });

    module.exports = DocumentStore;
});
