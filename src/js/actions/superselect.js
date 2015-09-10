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
        Immutable = require("immutable"),
        _ = require("lodash");

    var descriptor = require("adapter/ps/descriptor"),
        adapterOS = require("adapter/os"),
        adapterUI = require("adapter/ps/ui");

    var keyUtil = require("js/util/key"),
        system = require("js/util/system"),
        locks = require("js/locks"),
        events = require("js/events"),
        Bounds = require("js/models/bounds"),
        documentActions = require("./documents"),
        layerActions = require("./layers"),
        toolActions = require("./tools"),
        libraryActions = require("./libraries"),
        collection = require("js/util/collection"),
        uiUtil = require("js/util/ui"),
        headlights = require("js/util/headlights");

    /**
     * Wrapper for headlights logging superselect interactions
     *
     * @private
     * @param {string} eventName
     * @return {Promise}
     */
    var _logSuperselect = function (eventName) {
        return headlights.logEvent("tools", "superselect", eventName);
    };

    /**
     * Returns all leaf layers we can directly dive into
     * 
     * @private
     * @param  {LayerStructure} layerTree
     * @param  {Immutable.Iterable.<Layer>} parentLayers Layers to dive into
     * @return {Immutable.Iterable.<Layer>}
     */
    var _getDiveableLayers = function (layerTree, parentLayers) {
        return parentLayers
            .toSeq()
            .map(layerTree.children, layerTree) // Grab their children
            .flatten(true) // Flatten all children to one array
            .filter(function (layer) { // Only allow for unlocked, non-adjustment layers
                return layer.superSelectable;
            })
            .toList();
    };

    /**
     * Helper for backOut function
     * Gets all parents of selected layers
     * 
     * @param  {LayerStructure} layerTree
     * @param  {boolean} noDeselect Does not deselect root layers
     * @return {Immutable.Iterable.<Layer>} Parent layers of all selected layers
     */
    var _getSelectedLayerParents = function (layerTree, noDeselect) {
        return Immutable.List(layerTree.selected
            .reduce(function (parents, layer) {
                var parent = layerTree.parent(layer);
                // Don't get rid of root layers if noDeselect is passed
                if (noDeselect && !parent) {
                    return parents.add(layer);
                } else if (parent) {
                    return parents.add(parent);
                }

                return parents;
            }, new Set()));
    };

    /**
     * For every selected layer, returns the next sibling in it's group
     * For now, we only return one sibling
     *
     * @private
     * @param {LayerStructure} layerTree
     * @param {boolean} previous If true, will get previous sibling
     * @return {Immutable.Iterable.<Layer>}
     */
    var _getNextSiblingsForSelectedLayers = function (layerTree, previous) {
        if (layerTree.all.isEmpty()) {
            return Immutable.List();
        }

        var selectedLayers = layerTree.selected;

        if (selectedLayers.isEmpty()) {
            selectedLayers = layerTree.top;
        }

        var step = previous ? -1 : 1;

        // Should we want to return next sibling of all selected layers, delete this line
        selectedLayers = selectedLayers.take(1);
        
        return selectedLayers.map(function (layer) {
            var siblings = layerTree.siblings(layer)
                .filter(function (layer) {
                    return layer.superSelectable;
                });

            var layerIndex = siblings.isEmpty() ? 0 : siblings.indexOf(layer),
                nextIndex = (layerIndex + step) % siblings.size;

            return siblings.get(nextIndex);
        });
    };

    /**
     * Get all the layers and layer groups underneath x,y, including layer groups
     * 
     * This would only work with rectangular layers because bounds are boxes
     * @private
     * @param  {LayerStructure} layerTree
     * @param  {number} x
     * @param  {number} y
     * @return {Immutable.Set.<Layer>} All bounding boxes of layers/groups under the point
     */
    var _getContainingLayerBounds = function (layerTree, x, y) {
        return Immutable.Set(layerTree.all.reduce(function (layerSet, layer) {
            if (layerTree.hasInvisibleAncestor(layer) || !layer.superSelectable) {
                return layerSet;
            }

            var bounds;
            if (layer.isArtboard) {
                // We need the scale factor to be able to calculate the name badge correctly as it does not scale
                var scale = this.flux.store("ui").zoomCanvasToWindow(1) * window.devicePixelRatio;
                bounds = uiUtil.getNameBadgeBounds(layer.bounds, scale);
            } else {
                var layerBounds = layerTree.childBounds(layer),
                    topAncestor = layerTree.topAncestor(layer);

                if (topAncestor.isArtboard) {
                    var artboardBounds = layerTree.childBounds(topAncestor);

                    bounds = Bounds.intersection(artboardBounds, layerBounds);
                } else {
                    bounds = layerBounds;
                }
            }

            if (bounds && bounds.contains(x, y)) {
                layerSet.add(layer);
            }

            return layerSet;
        }, new Set(), this));
    };

    /**
     * Gets the artboards and leaf layers that have one of the passed in IDs
     * 
     * @param  {LayerStructure} layerTree
     * @param  {Object.<{number: boolean}>} layerMap       
     * @return {Immutable.Iterable.<Layer>}
     */
    var _getDirectAccessLayersWithID = function (layerTree, layerMap) {
        return layerTree.leaves.concat(layerTree.artboards).filter(function (layer) {
            return layerMap.has(layer.id);
        });
    };

    /**
     * Gets all artboards from the given ids
     * We use this to re-add name badges back into the clickable areas
     * 
     * @param {LayerStructure} layerTree
     * @param {Immutable.List.<number>} ids
     * @return {Immutable.Iterable.<Layer>}
     */
    var _getArtboardIDs = function (layerTree, ids) {
        return ids.filter(function (id) {
            var layer = layerTree.layers.get(id);
            
            return layer ? layer.isArtboard : true;
        });
    };

    /**
     * Checks to see if the layer is the only selected layer
     *
     * @private
     * @param {LayerStructure} layerTree
     * @param {Layer} layer
     * @return {boolean}
     */
    var _isOnlySelectedLayer = function (layerTree, layer) {
        var selected = layerTree.selected;
        if (selected.size !== 1) {
            return false;
        }

        return Immutable.is(selected.first(), layer);
    };

    /**
     * Filters out selected layers and families from the covered layers
     * 
     * @private
     * @param {LayerStructure} layerTree
     * @param {Immutable.Iterable.<Layer>} coveredLayers Layers under a certain point
     * @return {Immutable.Iterable.<number>} IDs of the subset of coveredLayers that do not own selected layers
     */
    var _getLayersBelowCurrentSelection = function (layerTree, coveredLayers) {
        var selectedLayerAncestors = layerTree.selected
                .reduce(function (layerSet, layer) {
                    layerTree.ancestors(layer).forEach(function (ancestor) {
                        layerSet.add(ancestor);
                    });
                    return layerSet;
                }, new Set()),
            selectableCoveredLayers = coveredLayers.filter(function (layer) {
                return !layer.locked && // Only allow for unlocked layers
                    layer.kind !== layer.layerKinds.GROUPEND &&
                    !selectedLayerAncestors.has(layer);
            });

        return collection.pluck(selectableCoveredLayers, "id");
    };

    /**
     * Enters the edit mode for the given layer
     * No-op if there is no special edit mode
     * 
     * @param {Document} document Active documentID
     * @param {Layer} layer layer to edit
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @return {Promise} 
     */
    var editLayer = function (document, layer, x, y) {
        // We don't want to do anything on background layer
        if (layer.isBackground) {
            return Promise.resolve();
        }
        
        var kinds = layer.layerKinds,
            tool,
            resultPromise;

        switch (layer.kind) {
        case kinds.VECTOR:
            // If this is called through keyboard, we calculate the center of the layer
            // This will not work if the layer is concave, as we can't click on an empty pixel
            if (!x || !y) {
                var bounds = layer.bounds;
                if (!bounds) {
                    return Promise.resolve();
                }

                x = (bounds.right + bounds.left) / 2;
                y = (bounds.top + bounds.bottom) / 2;

                var windowCoords = this.flux.store("ui").transformCanvasToWindow(x, y);
                x = windowCoords.x;
                y = windowCoords.y;
            }
            
            tool = this.flux.store("tool").getToolByID("superselectVector");
        
            _logSuperselect("edit_vector");
            resultPromise = this.transfer(toolActions.select, tool)
                .bind(this)
                .then(function () {
                    var eventKind = adapterOS.eventKind.LEFT_MOUSE_DOWN,
                        coordinates = [x, y];
                        
                    return adapterOS.postEvent({ eventKind: eventKind, location: coordinates });
                });
            break;
        case kinds.TEXT:
            tool = this.flux.store("tool").getToolByID("superselectType");
            
            _logSuperselect("edit_text");
            resultPromise = this.transfer(toolActions.select, tool)
                .bind(this)
                .then(function () {
                    return adapterUI.startEditWithCurrentModalTool();
                });
            break;
        case kinds.SMARTOBJECT:
            if (layer.isCloudLinkedSmartObject()) {
                _logSuperselect("edit_cloud_object");
                
                var elementReference = layer.getLibraryElementReference(),
                    element = this.flux.stores.library.getElementByReference(elementReference);
                    
                resultPromise = this.transfer(libraryActions.openGraphicForEdit, element);
            } else {
                // For linked smart objects, this option shows the fix broken link dialog if the link is broken
                
                var editOptions = {
                    interactionMode: descriptor.interactionMode.DISPLAY
                };

                _logSuperselect("edit_smart_object");
                resultPromise = descriptor.play("placedLayerEditContents", {}, editOptions)
                    .bind(this)
                    .then(function () {
                        // This updates the newly opened smart object document, although we should figure out a way
                        // to check to see if it's being opened in Photoshop
                        // Even if it's being opened in another app, the update call will not be visible to the user
                        return this.transfer(documentActions.updateDocument);
                    }, function () {
                        // We have an empty catch here, because PS throws cancel if user cancels on
                        // Resolve Missing File dialog.
                    });
            }
            break;
        default:
            resultPromise = Promise.resolve();
        }

        return resultPromise;
    };
    editLayer.reads = [locks.JS_UI, locks.JS_TOOL, locks.JS_DOC];
    editLayer.writes = [locks.PS_DOC];
    editLayer.transfers = [toolActions.select, documentActions.updateDocument, libraryActions.openGraphicForEdit];
    
    /**
     * Process a single click from the SuperSelect tool. First determines a set of
     * layers to select, then transfers control to actions.layers.select or
     * actions.layers.deselect.
     * 
     * @private
     * @param {Document} doc Document model
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @param {boolean} deep Whether to choose all layers or not
     * @param {boolean} add Whether to add/remove layer to selection
     * @return {Promise.<boolean>} True if any layers are selected after this command, used for dragging
     */
    var click = function (doc, x, y, deep, add) {
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerTree = doc.layers;
        
        return uiUtil.hitTestLayers(doc.id, coords.x, coords.y)
            .bind(this)
            .then(function (hitLayerIDs) {
                var clickedSelectableLayerIDs,
                    coveredLayers = _getContainingLayerBounds.call(this, layerTree, coords.x, coords.y),
                    coveredLayerIDs = collection.pluck(coveredLayers, "id"),
                    hitArtboardIDs = _getArtboardIDs(layerTree, coveredLayerIDs);

                coveredLayerIDs = collection.intersection(coveredLayerIDs, hitLayerIDs).concat(hitArtboardIDs);

                coveredLayerIDs = coveredLayerIDs.sortBy(function (id) {
                    return hitLayerIDs.indexOf(id);
                });

                if (deep) {
                    // Select any non-group layer, and allow for artboard badges
                    var hitLayerMap = new Set(coveredLayerIDs.toJS()),
                        clickedSelectableLayers = _getDirectAccessLayersWithID(layerTree, hitLayerMap);
                    
                    clickedSelectableLayerIDs = collection.pluck(clickedSelectableLayers, "id");
                } else {
                    var selectableLayers = layerTree.selectable,
                        clickableLayers = collection.intersection(selectableLayers, coveredLayers),
                        clickableLayerIDs = collection.pluck(clickableLayers, "id");
                    
                    clickedSelectableLayerIDs = collection.intersection(coveredLayerIDs, clickableLayerIDs);
                }

                if (!clickedSelectableLayerIDs.isEmpty()) {
                    // due to way hitTest works, the top z-order layer is the last one in the list
                    var topLayerID = clickedSelectableLayerIDs.last(),
                        topLayer = layerTree.byID(topLayerID),
                        modifier = "select";

                    if (add && topLayer.selected) {
                        // If we hold shift, and this is the only layer selected, we deselect all
                        if (_isOnlySelectedLayer(layerTree, topLayer)) {
                            _logSuperselect("deselect_all");
                            return this.transfer(layerActions.deselectAll, doc)
                                .return(false);
                        }
                        modifier = "deselect";
                    } else if (add) {
                        modifier = "add";
                    }

                    // If our single click is going to be a no-op, just prevent firing it at all
                    if (modifier === "select" && topLayer.selected) {
                        return Promise.resolve(true);
                    }

                    // Modifier can be "select", "deselect" or "add"
                    if (deep) {
                        _logSuperselect("click_deep_" + modifier);
                    } else {
                        _logSuperselect("click_" + modifier);
                    }

                    return this.transfer(layerActions.select, doc, topLayer, modifier)
                        .return(true);
                } else if (!doc.layers.selected.isEmpty()) {
                    _logSuperselect("deselect_all");
                    return this.transfer(layerActions.deselectAll, doc)
                        .return(false);
                } else {
                    return Promise.resolve(false);
                }
            });
    };
    click.reads = [locks.PS_DOC, locks.JS_DOC, locks.JS_TOOL, locks.JS_UI];
    click.writes = [];
    click.transfers = [layerActions.deselectAll, layerActions.select];

    /**
     * Process a double click
     * Double click dives into the next level of the selected group, selecting the layer under the click
     * NOTE: Double Click relies on the fact that single click was ran before hand
     * 
     * @private
     * @param {Document} doc Document model
     * @param {number} x Offset from the left window edge
     * @param {number} y Offset from the top window edge
     * @return {Promise}
     */
    var doubleClick = function (doc, x, y) {
        var uiStore = this.flux.store("ui"),
            coords = uiStore.transformWindowToCanvas(x, y),
            layerTree = doc.layers;

        return uiUtil.hitTestLayers(doc.id, coords.x, coords.y)
            .bind(this)
            .then(function (hitLayerIDs) {
                var diveIntoLayers = layerTree.selected;

                // If there is no selection, we start with top layers so artboards can be dived into
                if (diveIntoLayers.isEmpty()) {
                    diveIntoLayers = layerTree.top;
                }
                // Child layers of selected layers
                var selectableLayers = _getDiveableLayers(layerTree, diveIntoLayers);

                // If this is empty, we're probably trying to dive into an edit mode
                if (selectableLayers.isEmpty()) {
                    var selectedLayers = layerTree.selected,
                        clickedLayer = selectedLayers.find(function (layer) {
                            return hitLayerIDs.contains(layer.id);
                        });

                    if (clickedLayer) {
                        return this.transfer(layerActions.select, doc, clickedLayer)
                            .bind(this)
                            .then(function () {
                                _logSuperselect("double_click_edit");
                                return this.transfer(editLayer, doc, clickedLayer, x, y);
                            });
                    } else {
                        return Promise.resolve();
                    }
                }
                    
                // Layers/Groups under the mouse
                var coveredLayers = _getContainingLayerBounds.call(this, layerTree, coords.x, coords.y);
                // Valid children of selected under the mouse 
                var diveableLayers = collection.intersection(selectableLayers, coveredLayers);
                // Grab their ids...
                var diveableLayerIDs = collection.pluck(diveableLayers, "id");
                // Find the ones user actually clicked on
                var targetLayerIDs = collection.intersection(hitLayerIDs, diveableLayerIDs);
                // Get the top z-order one
                var topTargetID = targetLayerIDs.last();

                if (!targetLayerIDs.isEmpty()) {
                    _logSuperselect("double_click_select");
                    return this.transfer(layerActions.select, doc, layerTree.byID(topTargetID));
                } else {
                    // We get in this situation if user double clicks in a group with nothing underneath.
                    // We "fall down" to the super selectable layer underneath the selection in these cases
                    var underLayerIDs = _getLayersBelowCurrentSelection(layerTree, coveredLayers);
                    if (!underLayerIDs.isEmpty()) {
                        var topLayerID = underLayerIDs.last();
                        return this.transfer(layerActions.select, doc, layerTree.byID(topLayerID));
                    } else {
                        return Promise.resolve();
                    }
                }
            });
    };
    doubleClick.reads = [locks.JS_UI, locks.JS_DOC, locks.PS_DOC];
    doubleClick.writes = [];
    doubleClick.transfers = [layerActions.select, editLayer];

    /**
     * Backs out of the selected layers to their parents
     * 
     * @param {Document} doc
     * @param {boolean} noDeselect If true, top level layers will not be removed from selection
     * @return {Promise}
     */
    var backOut = function (doc, noDeselect) {
        var layerTree = doc.layers,
            backOutParents = _getSelectedLayerParents(layerTree, noDeselect);

        if (!backOutParents.isEmpty()) {
            _logSuperselect("key_backout");
            return this.transfer(layerActions.select, doc, backOutParents);
        } else if (!noDeselect) {
            _logSuperselect("key_backout_deselect");
            return this.transfer(layerActions.deselectAll, doc);
        } else {
            return Promise.resolve();
        }
    };
    backOut.reads = [locks.JS_DOC];
    backOut.writes = [];
    backOut.transfers = [layerActions.select, layerActions.deselectAll];

    /**
     * Skips to the next unlocked sibling layer of the first selected layer
     * 
     * @param {Document} doc
     * @return {Promise}
     */
    var nextSibling = function (doc, cycleBack) {
        var layerTree = doc.layers,
            nextSiblings = _getNextSiblingsForSelectedLayers(layerTree, cycleBack);

        _logSuperselect("key_next_sibling");
        return this.transfer(layerActions.select, doc, nextSiblings);
    };
    nextSibling.reads = [locks.JS_DOC];
    nextSibling.writes = [];
    nextSibling.transfers = [layerActions.select];

    /**
     * Dives in one level to the selected layer, no op if it's not a group layer
     * 
     * @param {Document} doc
     * @return {Promise}
     */
    var diveIn = function (doc) {
        var layerTree = doc.layers,
            diveableLayers = _getDiveableLayers(layerTree, layerTree.selected);

        // If this is empty, we're probably trying to dive into an edit mode
        if (diveableLayers.isEmpty()) {
            var selectedLayers = layerTree.selected;

            // Only dive into edit mode when there is one layer
            if (selectedLayers.size === 1) {
                var topLayer = selectedLayers.get(0);

                // Since locked layers can be selected from the panel,
                // we check for locking here
                if (topLayer.locked) {
                    return Promise.resolve();
                }
                _logSuperselect("key_edit");
                return this.transfer(editLayer, doc, topLayer);
            } else {
                return Promise.resolve();
            }
        } else {
            _logSuperselect("key_dive_in");
            return this.transfer(layerActions.select, doc, diveableLayers.first());
        }
    };
    diveIn.reads = [locks.JS_DOC];
    diveIn.writes = [];
    diveIn.transfers = [layerActions.select, editLayer];

    /**
     * Stores the move listener that was installed by the last drag command
     * so we can remove it if it hasn't been hit
     * Certain drag operations (like space+drag to move canvas) still hit
     * dragCommand method, so we gotta make sure there is only one move listener installed
     * for this function at any point
     *
     * @type {function(event)}
     */
    var _moveToArtboardListener = null,
        _newDuplicateSheetsListener = null;

    /**
     * Selects and starts dragging the layer around
     *
     * @param {Document} doc
     * @param {number} x Horizontal location of click
     * @param {number} y Vertical location of click
     * @param {{shift: boolean, control: boolean, alt: boolean, command: boolean}} modifiers Drag modifiers
     * @param {boolean} panning If true, will send the mouse event regardless
     * @return {Promise}           
     */
    var drag = function (doc, x, y, modifiers, panning) {
        var eventKind = adapterOS.eventKind.LEFT_MOUSE_DOWN,
            coordinates = [x, y],
            dragModifiers = keyUtil.modifiersToBits(modifiers),
            diveIn = system.isMac ? modifiers.command : modifiers.control,
            dontDeselect = modifiers.shift,
            copyDrag = modifiers.option;

        if (panning) {
            var dragEvent = {
                eventKind: eventKind,
                location: coordinates,
                modifiers: dragModifiers
            };

            return adapterOS.postEvent(dragEvent);
        }
        
        if (dontDeselect) {
            return this.dispatchAsync(events.ui.SUPERSELECT_MARQUEE, { x: x, y: y, enabled: true });
        } else {
            var uiStore = this.flux.store("ui"),
                canvasCoords = uiStore.transformWindowToCanvas(x, y),
                coveredLayers = _getContainingLayerBounds.call(this, doc.layers, canvasCoords.x, canvasCoords.y);

            if (coveredLayers.isEmpty()) {
                // This general bounds check on JS prevents a PS call and starts marquee faster
                return this.dispatchAsync(events.ui.SUPERSELECT_MARQUEE, { x: x, y: y, enabled: true });
            } else {
                return this.transfer(click, doc, x, y, diveIn, false)
                    .bind(this)
                    .then(function (anySelected) {
                        if (anySelected) {
                            if (_newDuplicateSheetsListener) {
                                descriptor.removeListener("newDuplicateSheets", _newDuplicateSheetsListener);
                            }

                            if (_moveToArtboardListener) {
                                descriptor.removeListener("moveToArtboard", _moveToArtboardListener);
                            }

                            if (copyDrag) {
                                _newDuplicateSheetsListener = function (event) {
                                    var newSheetIDlist = event.newSheetIDlist,
                                        toIDs = _.pluck(newSheetIDlist, "newLayerID");

                                    // TODO: The objects in this array also contain layerID and
                                    // newLayerIndex properties which could be used to implement
                                    // a somewhat more optimistic copy routine, instead of addLayers
                                    // which doesn't know that the layers being added are copies of
                                    // existing layers.
                                    this.flux.actions.layers.addLayers(doc, toIDs, true, false);
                                }.bind(this);

                                descriptor.once("newDuplicateSheets", _newDuplicateSheetsListener);
                            } else {
                                _moveToArtboardListener = _.once(function () {
                                    this.flux.actions.layers.resetIndex(doc, true, true);
                                }.bind(this));

                                descriptor.addListener("moveToArtboard", _moveToArtboardListener);
                            }

                            var dragEvent = {
                                eventKind: eventKind,
                                location: coordinates,
                                modifiers: dragModifiers
                            };

                            return adapterOS.postEvent(dragEvent);
                        }
                    })
                    .catch(function () {}); // Move should silently fail if there are no selected layers
            }
        }
    };
    drag.reads = [locks.JS_DOC];
    drag.writes = [locks.PS_DOC, locks.JS_UI];
    drag.transfers = [click];

    /**
     * Selects the given layers by the marquee
     * If no layers are passed, and add isn't true, will deselect all
     * Otherwise will add/transfer selection to layers
     *
     * @param {Document} doc Owner document
     * @param {boolean} runMarquee Will run marquee select only if true
     * @param {?Array.<number>} ids Layer IDs
     * @param {boolean} add Flag to add to or replace selection
     * @return {Promise}
     */
    var marqueeSelect = function (doc, runMarquee, ids, add) {
        this.dispatch(events.ui.SUPERSELECT_MARQUEE, { enabled: false });

        if (!runMarquee || !ids) {
            return Promise.resolve();
        }
        
        var layers = Immutable.List(ids.map(doc.layers.byID.bind(doc.layers))),
            modifier = add ? "add" : "select";

        if (layers.isEmpty() && !add) {
            _logSuperselect("marqueeDeselect");
            return this.transfer(layerActions.deselectAll, doc);
        } else if (!layers.isEmpty()) {
            _logSuperselect("marqueeSelect");
            return this.transfer(layerActions.select, doc, layers, modifier);
        } else {
            return Promise.resolve();
        }
    };
    marqueeSelect.reads = [locks.JS_DOC];
    marqueeSelect.writes = [locks.JS_UI];
    marqueeSelect.transfers = [layerActions.deselectAll, layerActions.select];

    exports.click = click;
    exports.doubleClick = doubleClick;
    exports.backOut = backOut;
    exports.nextSibling = nextSibling;
    exports.diveIn = diveIn;
    exports.drag = drag;
    exports.editLayer = editLayer;
    exports.marqueeSelect = marqueeSelect;
});
