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

    var descriptor = require("adapter").ps.descriptor,
        toolLib = require("adapter").lib.tool,
        layerLib = require("adapter").lib.layer,
        documentLib = require("adapter").lib.document,
        UI = require("adapter").ps.ui,
        OS = require("adapter").os,
        ps = require("adapter").ps,
        vectorMaskLib = require("adapter").lib.vectorMask;

    var events = require("../events"),
        guides = require("./guides"),
        layers = require("./layers"),
        mask = require("./mask"),
        locks = require("js/locks"),
        policy = require("./policy"),
        shortcuts = require("./shortcuts"),
        nls = require("js/util/nls"),
        layerActionsUtil = require("js/util/layeractions"),
        system = require("js/util/system"),
        headlights = require("js/util/headlights"),
        utilShortcuts = require("js/util/shortcuts"),
        synchronization = require("js/util/synchronization"),
        EventPolicy = require("js/models/eventpolicy"),
        PointerEventPolicy = EventPolicy.PointerEventPolicy;

    /**
     * Every time the layer selection / location changes, 
     * we create a border policy around the selection marquee (resetBorderPolicies)
     * This allows us to send mouse events to Photoshop for on canvas transforms
     * We store the policy ID in this variable so we can uninstall the last ones
     *
     * FIXME: This state should be moved to the tool store.
     *
     * @type {number}
     */
    var _currentTransformPolicyID = null;

    var directSelectToolID = "superselectVector";

    /**
     * Installs the defaults on a given shape tool
     * 
     * @param {string} tool the name of the tool we're using "ellipseTool" or "rectangleTool"
     * @param {Color} strokeColor a 3 item array represetning the [r,g,b] value of the stroke
     * @param {number} strokeSize the width of the stroke
     * @param {number} strokeOpacity the opacity of the stroke
     * @param {Color} fillColor a 3 item array represetning the [r,g,b] value of the fill
     *
     * @return {Promise}
     */
    var installShapeDefaults = function (tool, strokeColor, strokeSize, strokeOpacity, fillColor) {
        if (strokeColor === undefined) {
            strokeColor = [157, 157, 157];
        }
        if (fillColor === undefined) {
            fillColor = [217, 217, 217];
        }
        if (strokeOpacity === undefined) {
            strokeOpacity = 100;
        }
        if (strokeSize === undefined) {
            strokeSize = 1;
        }

        var document = this.flux.store("application").getCurrentDocument(),
            defaultObj = toolLib.defaultShapeTool(tool, strokeColor, strokeSize, strokeOpacity, fillColor);
            
        // If document doesn't exist, or is a flat document
        if (!document || document.unsupported || document.layers.all.size === 1 &&
            document.layers.all.first().isBackground) {
            return descriptor.playObject(defaultObj);
        }
        var layerSpec = document.layers.allSelected.toList();

        if (layerSpec.isEmpty()) {
            return descriptor.playObject(defaultObj);
        }

        var layerRef = layerSpec
                .map(function (layer) {
                    return layerLib.referenceBy.id(layer.id);
                })
                .unshift(documentLib.referenceBy.id(document.id))
                .toArray();

        var selectObj = layerLib.select(layerRef, false);

        return descriptor.batchPlayObjects([layerLib.deselectAll(), defaultObj, selectObj]);
    };
    installShapeDefaults.action = {
        reads: [locks.JS_APP, locks.JS_DOC],
        writes: [locks.PS_TOOL, locks.PS_DOC],
        modal: true
    };

    /**
     * Calculates the policy rectangles for the given bounds object
     * Helper for resetBorderPolicies
     *
     * @private
     * @param {Bounds} bounds
     * @param {booelan} isArtboard If true, will not include rotation areas
     * @return {Array.<Policy>}
     */
    var _calculatePolicyRectangles = function (bounds, isArtboard) {
        // Photoshop transform controls are either clickable on the corner squares for resizing
        // or in a 25 point area around them for rotating, to allow mouse clicks only in that area
        // we first create a policy covering the bigger area (width defined by offset + inset)
        // that sends all clicks to Photoshop. But to allow selection clicks to go through inside,
        // we set an inset policy over that other rectangle, creating a "frame" of mouse selection policy
        var uiStore = this.flux.store("ui"),
            psSelectionTL = uiStore.transformCanvasToWindow(
                bounds.left, bounds.top
            ),
            psSelectionBR = uiStore.transformCanvasToWindow(
                bounds.right, bounds.bottom
            ),
            psSelectionWidth = psSelectionBR.x - psSelectionTL.x,
            psSelectionHeight = psSelectionBR.y - psSelectionTL.y,
            // The resize rectangles are roughly 8 points radius
            inset = 4,
            // In case of artboards, we have no rotate, so we can stay within the border
            outset = isArtboard ? inset : 27,
            distortModifier = system.isMac ? { command: true } : { control: true };

        // Rectangles used in polices below
        var innerRect = {
                x: psSelectionTL.x + inset,
                y: psSelectionTL.y + inset,
                width: Math.max(psSelectionWidth - (inset * 2), 0),
                height: Math.max(psSelectionHeight - (inset * 2), 0)
            },
            middleRect = {
                x: psSelectionTL.x - inset,
                y: psSelectionTL.y - inset,
                width: psSelectionWidth + (inset * 2),
                height: psSelectionHeight + (inset * 2)
            },
            outerRect = {
                x: psSelectionTL.x - outset,
                y: psSelectionTL.y - outset,
                width: psSelectionWidth + (outset * 2),
                height: psSelectionHeight + (outset * 2)
            };

        var insidePolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_TO_BROWSER,
                OS.eventKind.LEFT_MOUSE_DOWN,
                {}, // no modifiers inside
                innerRect
            ),
            insideCommandPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_TO_BROWSER,
                OS.eventKind.LEFT_MOUSE_DOWN,
                distortModifier,
                innerRect
            ),
            insideShiftPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_TO_BROWSER,
                OS.eventKind.LEFT_MOUSE_DOWN,
                { shift: true },
                innerRect
            ),
            insideCommandShiftPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_TO_BROWSER,
                OS.eventKind.LEFT_MOUSE_DOWN,
                _.merge(distortModifier, { shift: true }),
                innerRect
            ),
            // Used for distort/skew transformations
            noOutsetCommandPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_BY_ALPHA,
                OS.eventKind.LEFT_MOUSE_DOWN,
                distortModifier,
                middleRect
            ),
            // Used for proportional resize
            noOutsetShiftPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_BY_ALPHA,
                OS.eventKind.LEFT_MOUSE_DOWN,
                { shift: true },
                middleRect
            ),
            // Used for proportional distort/skew
            noOutsetCommandShiftPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_BY_ALPHA,
                OS.eventKind.LEFT_MOUSE_DOWN,
                _.merge({ shift: true }, distortModifier),
                middleRect
            ),
            // Used for rotation
            outsidePolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_BY_ALPHA,
                OS.eventKind.LEFT_MOUSE_DOWN,
                {},
                outerRect
            ),
            // Used for constrained rotation
            outsideShiftPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_BY_ALPHA,
                OS.eventKind.LEFT_MOUSE_DOWN,
                { shift: true },
                outerRect
            );

        var pointerPolicyList = [
            insidePolicy,
            insideCommandPolicy,
            insideShiftPolicy,
            insideCommandShiftPolicy,
            noOutsetCommandPolicy,
            noOutsetShiftPolicy,
            noOutsetCommandShiftPolicy,
            outsidePolicy,
            outsideShiftPolicy
        ];

        return pointerPolicyList;
    };

    /**
     * Resets the pointer policies around the selection border so we can pass
     * pointer events to Photoshop for transforming, but still be able to
     * click through to other layers
     *
     * @return {Promise}
     */
    var resetBorderPolicies = function () {
        var toolStore = this.flux.store("tool"),
            appStore = this.flux.store("application"),
            currentDocument = appStore.getCurrentDocument(),
            currentPolicy = _currentTransformPolicyID,
            currentTool = toolStore.getCurrentTool(),
            removePromise = currentPolicy ?
                this.transfer(policy.removePointerPolicies, currentPolicy, true) : Promise.resolve(),
            guidePromise; // We want to set these after border policies

        // if we are in vector mask mode we should not change pointer policies 
        if (toolStore.getVectorMode()) {
            return this.transfer(policy.syncAllPolicies);
        }

        // Make sure to always remove the remaining policies
        if (!currentDocument || !currentTool || currentTool.id !== "newSelect") {
            _currentTransformPolicyID = null;
            guidePromise = this.transfer(guides.resetGuidePolicies);

            return Promise.join(removePromise, guidePromise)
                .bind(this)
                .then(function () {
                    return this.transfer(policy.syncAllPolicies);
                });
        }

        var targetLayers = currentDocument.layers.selected,
            overallSelection = currentDocument.layers.selectedAreaBounds;

        // If selection is empty, remove existing policy
        if (!overallSelection || overallSelection.empty) {
            _currentTransformPolicyID = null;
            guidePromise = this.transfer(guides.resetGuidePolicies);

            return Promise.join(removePromise, guidePromise)
                .bind(this)
                .then(function () {
                    return this.transfer(policy.syncAllPolicies);
                });
        }

        var anyArtboards = targetLayers.some(function (layer) {
                return layer.isArtboard;
            }),
            pointerPolicyList;

        if (anyArtboards) {
            pointerPolicyList = targetLayers.reduce(function (list, layer) {
                var artboard = layer.isArtboard;

                // If we have any artboards selected, and some other layer
                // we don't want to draw policies around the other layer
                // because PS won't either.
                if (!artboard) {
                    return list;
                }

                var bounds = currentDocument.layers.childBounds(layer);
                return list.concat(_calculatePolicyRectangles.call(this, bounds, artboard));
            }.bind(this), []);
        } else {
            pointerPolicyList = _calculatePolicyRectangles.call(this, overallSelection, false);
        }
                    
        _currentTransformPolicyID = null;
        
        return removePromise
            .bind(this)
            .then(function () {
                return this.transfer(policy.addPointerPolicies, pointerPolicyList);
            })
            .then(function (policyID) {
                _currentTransformPolicyID = policyID;

                return this.transfer(guides.resetGuidePolicies);
            });
    };
    resetBorderPolicies.action = {
        reads: [locks.JS_APP, locks.JS_DOC, locks.JS_TOOL, locks.JS_UI],
        writes: [],
        transfers: [
            policy.removePointerPolicies,
            policy.addPointerPolicies,
            policy.syncAllPolicies,
            guides.resetGuidePolicies
        ],
        modal: true
    };

    /**
     * Swaps the policies of the current tool with the next tool
     * if nextTool is null, just uninstalls the policies
     * 
     * @param  {Tool} nextTool Next tool to be installed
     * @return {Promise.<{
     *             tool: Tool, 
     *             keyboardPolicyListID: number, 
     *             pointerPolicyListID: number
     *         }>}
     *         Resolves to the new tool and it's policy IDs
     */
    var swapPolicies = function (nextTool) {
        var toolStore = this.flux.store("tool"),
            nextToolKeyboardPolicyList = nextTool ? nextTool.keyboardPolicyList : [],
            nextToolPointerPolicyList = nextTool ? nextTool.pointerPolicyList : [];

        if (_.isFunction(nextToolPointerPolicyList)) {
            nextToolPointerPolicyList = nextToolPointerPolicyList.call(this);
        }

        var previousToolKeyboardPolicyListID = toolStore.getCurrentKeyboardPolicyID(),
            previousToolPointerPolicyListID = toolStore.getCurrentPointerPolicyID();

        // Swap keyboard policies
        var removeKeyboardPolicyPromise;
        if (previousToolKeyboardPolicyListID !== null) {
            removeKeyboardPolicyPromise = this.transfer(policy.removeKeyboardPolicies,
                previousToolKeyboardPolicyListID, true); // delay commit
        } else {
            removeKeyboardPolicyPromise = Promise.resolve();
        }

        var swapKeyboardPolicyPromise = removeKeyboardPolicyPromise
            .bind(this)
            .then(function () {
                return this.transfer(policy.addKeyboardPolicies, nextToolKeyboardPolicyList, true);
            });
        
        // Swap pointer policy
        var removePointerPolicyPromise;
        if (previousToolPointerPolicyListID !== null) {
            removePointerPolicyPromise = this.transfer(policy.removePointerPolicies,
                previousToolPointerPolicyListID, true); // delay commit
        } else {
            removePointerPolicyPromise = Promise.resolve();
        }

        var swapPointerPolicyPromise = removePointerPolicyPromise
            .bind(this)
            .then(function () {
                return this.transfer(policy.addPointerPolicies, nextToolPointerPolicyList, true);
            });

        return Promise.join(swapKeyboardPolicyPromise, swapPointerPolicyPromise,
            function (nextToolKeyboardPolicyListID, nextToolPointerPolicyListID) {
                return this.transfer(policy.syncAllPolicies)
                    .return({
                        tool: nextTool,
                        keyboardPolicyListID: nextToolKeyboardPolicyListID,
                        pointerPolicyListID: nextToolPointerPolicyListID
                    });
            }.bind(this));
    };
    swapPolicies.action = {
        reads: [locks.JS_TOOL],
        writes: [],
        transfers: [
            policy.removeKeyboardPolicies, policy.addKeyboardPolicies,
            policy.removePointerPolicies, policy.addPointerPolicies,
            policy.syncAllPolicies
        ],
        modal: true
    };

    /**
     * Activates a logical tool
     *
     * @param {Tool} nextTool
     * @return {Promise} Resolves to tool change
     */
    var selectTool = function (nextTool) {
        var toolStore = this.flux.store("tool"),
            currentTool = toolStore.getCurrentTool();

        // Remove the border policy if it's been set at some point
        // But not if we're resetting the same tool
        var removeTransformPolicyPromise;
        if (_currentTransformPolicyID && currentTool !== nextTool) {
            var policyID = _currentTransformPolicyID;
            _currentTransformPolicyID = null;
            removeTransformPolicyPromise = this.transfer(policy.removePointerPolicies, policyID, true);
        } else {
            removeTransformPolicyPromise = Promise.resolve();
        }

        var deselectHandlerPromise;

        if (currentTool && currentTool.deselectHandler) {
            // Calls the deselect handler of last tool
            deselectHandlerPromise = this.transfer(currentTool.deselectHandler, currentTool);
        } else {
            deselectHandlerPromise = Promise.resolve();
        }

        // Dispatch partial event ASAP so that the toolbar can redraw immediately
        var dispatchPromise = this.dispatchAsync(events.tool.SELECT_TOOL_START, {
            tool: nextTool
        });

        return Promise.join(removeTransformPolicyPromise, deselectHandlerPromise)
            .bind(this)
            .then(function () {
                // Set the new native tool
                var psToolName = nextTool.nativeToolName.call(this),
                    setToolPlayObject = toolLib.setTool(psToolName),
                    nativeToolPromise = descriptor.playObject(setToolPlayObject);

                var disableVectorMaskModePromise;
                if (!nextTool.handleVectorMaskMode) {
                    disableVectorMaskModePromise = this.dispatch(events.tool.VECTOR_MASK_MODE_CHANGE, false);
                } else {
                    disableVectorMaskModePromise = null;
                }

                return Promise.join(nativeToolPromise, disableVectorMaskModePromise);
            })
            .then(function () {
                var selectHandler = nextTool.selectHandler,
                    selectHandlerPromise;

                // Calls the select handler of new tool
                if (selectHandler) {
                    selectHandlerPromise = this.transfer(selectHandler, nextTool);
                } else {
                    selectHandlerPromise = null;
                }

                var resetCursorPromise = OS.resetCursor(),
                    swapPoliciesPromise = this.transfer(swapPolicies, nextTool);

                return Promise.join(swapPoliciesPromise, selectHandlerPromise, resetCursorPromise, dispatchPromise,
                    function (result) {
                        this.dispatch(events.tool.SELECT_TOOL_END, result);
                    }.bind(this));
            });
    };
    selectTool.action = {
        reads: [],
        writes: [locks.JS_TOOL, locks.PS_TOOL],
        transfers: [swapPolicies, policy.removePointerPolicies,
            "tool.superselect.select", "tool.superselect.deselect",
            "tool.superselect.vector.select", "tool.superselect.vector.deselect",
            "tool.superselect.type.select", "tool.superselect.type.deselect",
            "tool.ellipse.select",
            "tool.pen.select", "tool.pen.deselect",
            "tool.rectangle.select",
            "tool.sampler.select", "tool.sampler.deselect",
            "tool.type.select", "tool.type.deselect"
        ]
    };

    /**
     * Initialize the current tool based on the current native tool
     *
     * @return {Promise.<Tool>} Resolves to current tool name
     */
    var initTool = function () {
        var toolStore = this.flux.store("tool"),
            tool;

        // Check the current native tool
        return descriptor.getProperty("application", "tool")
            .bind(this)
            .then(function (toolObject) {
                var psToolName = toolObject._enum;
                    
                tool = toolStore.inferTool(psToolName);
                if (!tool) {
                    // Unable to infer tool from native tool; fall back to default
                    tool = toolStore.getDefaultTool();
                }
                
                return this.transfer(selectTool, tool);
            });
    };
    initTool.action = {
        reads: [locks.JS_TOOL],
        writes: [],
        modal: true,
        transfers: [selectTool]
    };

    /**
     * Notify the stores of the modal state change
     * 
     * @param {boolean} modalState
     * @return {Promise}
     */
    var changeModalState = function (modalState) {
        return this.dispatchAsync(events.tool.MODAL_STATE_CHANGE, {
            modalState: modalState
        });
    };
    changeModalState.action = {
        reads: [],
        writes: [locks.JS_TOOL],
        modal: true
    };

    /**
     * Async handler for the toolModalStateChanged event.
     *
     * @param {object} event
     * @return {Promise}
     */
    var handleToolModalStateChanged = function (event) {
        var modalState = (event.state._value === "enter"),
            changeStatePromise = this.transfer(changeModalState, modalState),
            policyStore = this.flux.stores.policy,
            policyPromise;

        // Suspend policies during type tool modal states
        // Except for Direct Selection Tool (ptha) because we need keyboard events in mask mode
        if (event.kind._value === "tool" && event.tool.ID !== "ptha") {
            if (modalState && !policyStore.areAllSuspended()) {
                policyPromise = this.transfer(policy.suspendAllPolicies);
            } else if (!modalState && policyStore.areAllSuspended()) {
                policyPromise = this.transfer(policy.restoreAllPolicies);
            } else {
                policyPromise = Promise.resolve();
            }
        } else {
            policyPromise = Promise.resolve();
        }

        // During artboard transforms, PS switches to artboard tool, so switch back to superselect
        var cloakPromise;
        if (event.kind._value === "mouse" && event.tool && event.tool.ID === "ArtT") {
            cloakPromise = this.transfer("panel.cloak");
        }

        return Promise.join(changeStatePromise, policyPromise, cloakPromise);
    };
    handleToolModalStateChanged.action = {
        reads: [],
        writes: [],
        transfers: [policy.suspendAllPolicies, policy.restoreAllPolicies,
            changeModalState, "panel.cloak"],
        modal: true
    };

    /**
     * Change the tool's vector mask mode
     * This function will both dispatch a vector_mask_mode_changed event for the store
     * and modify the current tool in order to set its properties to mask mode. 
     * 
     * @param {boolean} vectorMaskMode
     * @return {Promise}
     */
    var changeVectorMaskMode = function (vectorMaskMode) {
        var flux = this.flux,
            toolStore = flux.store("tool"),
            prevVectorMode = toolStore.getVectorMode(),
            currentTool = toolStore.getCurrentTool(),
            firstLaunch = true;

        // entering Vector Mask Mode is only permitted while in a subset of our tools
        if (prevVectorMode === vectorMaskMode || !currentTool.handleVectorMaskMode) {
            return Promise.resolve();
        }

        var appStore = flux.store("application"),
            currentDocument = appStore.getCurrentDocument();

        if (!currentDocument) {
            if (vectorMaskMode) {
                return Promise.resolve();
            } else {
                return this.dispatchAsync(events.tool.VECTOR_MASK_MODE_CHANGE, vectorMaskMode);
            }
        }

        var currentLayers = currentDocument.layers.selected,
            currentLayer = currentLayers.last();

        if (currentLayers.size > 2) {
            return Promise.resolve();
        } else if (currentLayers.size === 2) {
            return this.transfer(mask.createVectorMaskFromShape);
        }

        // vector mask mode requires an active layer
        if (!currentLayer) {
            if (vectorMaskMode) {
                return Promise.resolve();
            } else {
                return this.dispatchAsync(events.tool.VECTOR_MASK_MODE_CHANGE, vectorMaskMode);
            }
        }

        var nonVectorModeLayer = !currentDocument.layers.selectedLayersCanHaveVectorMask;

        if (vectorMaskMode && nonVectorModeLayer) {
            return Promise.resolve();
        }

        var initPromise,
            dispatchPromise,
            removePromise,
            policyPromise,
            directSelectShortcutPromise,
            createMaskOptions = {
                historyStateInfo: {
                    name: nls.localize("strings.ACTIONS.ADD_VECTOR_MASK"),
                    target: documentLib.referenceBy.id(currentDocument.id)
                }
            };

        // if we are swtiching to vector mask mode, make sure the layer has a vector mask
        if (!currentLayer.vectorMaskEnabled && vectorMaskMode === true) {
            var createActions = Immutable.List.of({ layer: currentLayer,
                        playObject: vectorMaskLib.createRevealAllMask() });

            initPromise = layerActionsUtil.playLayerActions(currentDocument, createActions,
                    true, createMaskOptions);

            var payload = {
                    documentID: currentDocument.id,
                    layerIDs: Immutable.List.of(currentLayer.id),
                    vectorMaskEnabled: true,
                    history: {
                        newState: true,
                        name: nls.localize("strings.ACTIONS.ADD_VECTOR_MASK")
                    }
                },
                dispatchAdd = this.dispatchAsync(events.document.history.ADD_VECTOR_MASK_TO_LAYER, payload),
                dispatchToolMode = this.dispatchAsync(events.tool.VECTOR_MASK_MODE_CHANGE, vectorMaskMode);

            dispatchPromise = Promise.join(dispatchAdd, dispatchToolMode);
        } else {
            initPromise = Promise.resolve();
            dispatchPromise = this.dispatchAsync(events.tool.VECTOR_MASK_MODE_CHANGE, vectorMaskMode);
        }

        var toolMode = toolLib.toolModes.SHAPE;

        if (vectorMaskMode) {
            toolMode = toolLib.toolModes.PATH;
        }
         
        if (vectorMaskMode) {
            var pointerPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_BY_ALPHA,
                    OS.eventKind.LEFT_MOUSE_DOWN),
                rightPointerPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_TO_BROWSER,
                    OS.eventKind.RIGHT_MOUSE_DOWN, { control: true }),
                pointerPolicyList;

            if (system.isMac) {
                var contextPointerPolicy = new PointerEventPolicy(UI.policyAction.PROPAGATE_TO_BROWSER,
                    OS.eventKind.LEFT_MOUSE_DOWN, { control: true });
                
                pointerPolicyList = [rightPointerPolicy, contextPointerPolicy, pointerPolicy];
            } else {
                pointerPolicyList = [rightPointerPolicy, pointerPolicy];
            }
            
            policyPromise = this.transfer(policy.addPointerPolicies, pointerPolicyList)
                .bind(this)
                .then(function (policyID) {
                    this.dispatch(events.tool.VECTOR_MASK_POLICY_CHANGE, policyID);
                });
            removePromise = Promise.resolve();

            directSelectShortcutPromise = this.transfer(shortcuts.addShortcut, utilShortcuts.GLOBAL.TOOLS.VECTOR_SELECT,
                {}, _vectorSelectMaskHandler, directSelectToolID,
                true, nls.localize("strings.TOOLS.NAMES.DIRECT_SELECTION_TOOL"));
        } else {
            // delete empty masks when leaving mask mode
            var shortcutStore = this.flux.store("shortcut");
            removePromise = this.transfer(layers.resetLayers, currentDocument, currentLayer)
                .bind(this)
                .then(function () {
                    currentLayer = appStore.getCurrentDocument().layers.selected.first();

                    if (currentLayer.vectorMaskEnabled && currentLayer.vectorMaskEmpty) {
                        var deleteMaskOptions = {
                                historyStateInfo: {
                                    name: nls.localize("strings.ACTIONS.DELETE_VECTOR_MASK"),
                                    target: documentLib.referenceBy.id(currentDocument.id)
                                }
                            },
                            deleteActions = Immutable.List.of({ layer: currentLayer,
                                playObject: vectorMaskLib.deleteVectorMask() });

                        return layerActionsUtil.playLayerActions(currentDocument, deleteActions,
                                true, deleteMaskOptions)
                            .bind(this)
                            .then(function () {
                                var payload = {
                                        documentID: currentDocument.id,
                                        layerIDs: Immutable.List.of(currentLayer.id),
                                        vectorMaskEnabled: false,
                                        history: {
                                            newState: true,
                                            name: nls.localize("strings.ACTIONS.DELETE_VECTOR_MASK")
                                        }
                                    },
                                    event = events.document.history.REMOVE_VECTOR_MASK_FROM_LAYER;

                                return this.dispatchAsync(event, payload);
                            });
                    } else {
                        return Promise.resolve();
                    }
                });

            if (shortcutStore.getByID(directSelectToolID)) {
                directSelectShortcutPromise = this.transfer(shortcuts.removeShortcut, directSelectToolID);
            }

            var pointerPolicyID = toolStore.getVectorMaskPolicyID();
         
            if (pointerPolicyID) {
                policyPromise = this.transfer(policy.removePointerPolicies, pointerPolicyID)
                .bind(this)
                .then(function () {
                    this.dispatch(events.tool.VECTOR_MASK_POLICY_CHANGE, null);
                });
            }
        }
        
        if (currentTool.id === "rectangle" || currentTool.id === "ellipse" || currentTool.id === "pen") {
            var setObj = toolLib.setShapeToolMode(toolMode),
                resetPromise = descriptor.batchPlayObjects([setObj]);

            if (!vectorMaskMode && firstLaunch) {
                var defaultPromise = this.transfer(installShapeDefaults,
                    currentTool.nativeToolName());

                firstLaunch = false;
                return Promise.join(initPromise, defaultPromise, resetPromise, dispatchPromise, policyPromise,
                    removePromise, directSelectShortcutPromise);
            } else if (!vectorMaskMode) {
                return Promise.join(initPromise, resetPromise, dispatchPromise, policyPromise,
                    removePromise, directSelectShortcutPromise);
            } else {
                return Promise.join(initPromise, resetPromise, dispatchPromise, policyPromise,
                    removePromise, directSelectShortcutPromise)
                .then(function () {
                    return UI.setSuppressTargetPaths(false);
                })
                .then(function () {
                    if (!currentLayer.vectorMaskEmpty) {
                        return descriptor.playObject(vectorMaskLib.activateVectorMaskEditing());
                    } else {
                        return Promise.resolve();
                    }
                });
            }
        } else if (currentTool.id === "newSelect" || currentTool.id === directSelectToolID) {
            if (!vectorMaskMode) {
                return this.transfer(selectTool, toolStore.getToolByID("newSelect"))
                .then(function () {
                    return Promise.join(initPromise, dispatchPromise, policyPromise,
                        removePromise, directSelectShortcutPromise);
                });
            } else {
                return this.transfer(selectTool, toolStore.getToolByID(directSelectToolID))
                .then(function () {
                    return Promise.join(initPromise, dispatchPromise, policyPromise,
                        removePromise, directSelectShortcutPromise);
                })
                .bind(this)
                .then(function () {
                    return ps.endModalToolState(true)
                        .catch(function () {
                            // If the modal state has already ended, quietly continue
                        });
                })
                .then(function () {
                    if (!currentLayer.vectorMaskEmpty) {
                        return descriptor.playObject(vectorMaskLib.activateVectorMaskEditing())
                            .bind(this)
                            .then(function () {
                                // We are not transfering here, because we activly want to end the use of our locks
                                this.flux.actions.tools.enterPathModalState();
                            });
                    }
                    return Promise.resolve();
                });
            }
        }

        headlights.logEvent("tools", "mask-mode", String(currentLayer.kind).toLowerCase());
    };
    changeVectorMaskMode.action = {
        reads: [locks.JS_APP, locks.JS_TOOL, locks.PS_DOC, locks.PS_TOOL],
        writes: [locks.JS_TOOL, locks.PS_DOC],
        modal: true,
        transfers: [selectTool, policy.addPointerPolicies, policy.removePointerPolicies,
            installShapeDefaults, "layers.resetLayers", mask.createVectorMaskFromShape,
            "shortcuts.removeShortcut", "shortcuts.addShortcut"]
    };

    /**
     * Enter the free transform path mode modal tool state. 
     * We do not care if this event fails, and it may take a long time to return 
     * 
     * @return {Promise}
     */
    var enterPathModalState = function () {
        descriptor.batchPlayObjects([vectorMaskLib.enterFreeTransformPathMode()],
                { synchronous: false })
            .catch(function () {
                // Silence the errors here since we cannot guarantee that PS will not throw an error
                // when we end the modal tool state in a valid case
            });
        return Promise.resolve();
    };
    enterPathModalState.action = {
        reads: [],
        writes: [],
        modal: true
    };

    /**
     * Event handler initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _toolModalStateChangedHandler,
        _borderPolicyChangeHandler,
        _vectorMaskHandler,
        _vectorSelectMaskHandler;

    /**
     * Register event listeners for native tool selection change events and
     * initialize the currently selected tool.
     * 
     * @return {Promise}
     */
    var beforeStartup = function () {
        var flux = this.flux,
            appStore = flux.store("application"),
            uiStore = this.flux.store("ui"),
            toolStore = this.flux.store("tool"),
            panelStore = this.flux.store("panel"),
            documentLayerBounds,
            topSelectedLayers,
            activeTool,
            canvasRectangle,
            uiTransformMatrix;

        var throttledResetBorderPolicies =
            synchronization.throttle(this.flux.actions.tools.resetBorderPolicies, this, 100);
            
        _borderPolicyChangeHandler = function () {
            if (!this.controller.active) {
                return;
            }
            var currentDocument = appStore.getCurrentDocument();

            if (currentDocument) {
                var nextDocumentLayerBounds = currentDocument.layers.selectedChildBounds,
                    nextTopSelectedLayers = currentDocument.layers.selectedTopAncestors,
                    newxUiTransformMatrix = uiStore.getCurrentTransformMatrix(),
                    newCanvasRectangle = panelStore.getCloakRect(),
                    newTool = toolStore.getCurrentTool();
                    
                if (!Immutable.is(documentLayerBounds, nextDocumentLayerBounds) ||
                        !Immutable.is(topSelectedLayers, nextTopSelectedLayers) ||
                        !_.isEqual(uiTransformMatrix, newxUiTransformMatrix) ||
                        !_.isEqual(canvasRectangle, newCanvasRectangle) ||
                        activeTool !== newTool) {
                    documentLayerBounds = nextDocumentLayerBounds;
                    topSelectedLayers = nextTopSelectedLayers;
                    uiTransformMatrix = newxUiTransformMatrix;
                    activeTool = newTool;
                    canvasRectangle = newCanvasRectangle;
                    throttledResetBorderPolicies();
                }
            } else {
                throttledResetBorderPolicies();
                documentLayerBounds = null;
            }
        }.bind(this);

        this.flux.store("document").on("change", _borderPolicyChangeHandler);
        this.flux.store("application").on("change", _borderPolicyChangeHandler);
        this.flux.store("ui").on("change", _borderPolicyChangeHandler);
        this.flux.store("tool").on("change", _borderPolicyChangeHandler);
        this.flux.store("panel").on("change", _borderPolicyChangeHandler);

        // Listen for modal tool state entry/exit events
        _toolModalStateChangedHandler = this.flux.actions.tools.handleToolModalStateChanged.bind(this);
        descriptor.addListener("toolModalStateChanged", _toolModalStateChangedHandler);

        return this.transfer(initTool); // Initialize the current tool
    };
    beforeStartup.action = {
        reads: [],
        writes: [],
        modal: true,
        transfers: [initTool]
    };

    /**
     * Register tool-activation shortcuts.
     *
     * @return {Promise}
     */
    var afterStartup = function () {
        var flux = this.flux,
            toolStore = this.flux.store("tool"),
            tools = toolStore.getAllTools();

        // Setup tool activation keyboard shortcuts
        var shortcutSpecs = tools.reduce(function (specs, tool) {
            var activationKey = tool.activationKey;

            if (!activationKey) {
                return specs;
            }

            var activateTool = function () {
                var applicationStore = flux.store("application"),
                    currentDocument = applicationStore.getCurrentDocument();

                // Only select if it's not the case that the current document is unsupported
                if (!currentDocument || !currentDocument.unsupported) {
                    flux.actions.tools.select(tool);
                }
            };

            specs.push({
                key: activationKey,
                modifiers: {},
                fn: activateTool,
                name: tool.name
            });

            // Add U as another shortcut for rectangle tool, hidden in here for now
            // FIXME: Change tool architecture to support multiple shortcuts for 1.1 - Barkin
            if (tool.id === "rectangle") {
                specs.push({
                    key: utilShortcuts.GLOBAL.TOOLS.SHAPE,
                    modifiers: {},
                    fn: activateTool
                });
            }

            return specs;
        }.bind(this), []);

        _vectorMaskHandler = function () {
            var vectorMode = toolStore.getVectorMode();
            this.flux.actions.tools.changeVectorMaskMode(!vectorMode);
        }.bind(this);

        shortcutSpecs.push({
            key: utilShortcuts.GLOBAL.TOOLS.MASK_SELECT,
            modifiers: {},
            fn: _vectorMaskHandler,
            name: nls.localize("strings.TOOLS.NAMES.VECTOR_MASK_MODE")
        });

        _vectorSelectMaskHandler = function () {
            if (toolStore.getVectorMode()) {
                flux.actions.tools.select(toolStore.getToolByID(directSelectToolID));
            }
        }.bind(this);

        if (toolStore.getVectorMode()) {
            _vectorSelectMaskHandler = function () {
                flux.actions.select(toolStore.getToolByID(directSelectToolID));
            }.bind(this);

            shortcutSpecs.push({
                key: utilShortcuts.GLOBAL.TOOLS.VECTOR_SELECT,
                modifiers: {},
                id: directSelectToolID,
                fn: _vectorSelectMaskHandler,
                name: toolStore.getToolByID(directSelectToolID).name
            });
        }

        return this.transfer(shortcuts.addShortcuts, shortcutSpecs);
    };
    afterStartup.action = {
        reads: [locks.JS_TOOL],
        writes: [],
        modal: true,
        transfers: [shortcuts.addShortcuts]
    };

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);
        this.flux.store("document").removeListener("change", _borderPolicyChangeHandler);
        this.flux.store("application").removeListener("change", _borderPolicyChangeHandler);
        this.flux.store("ui").removeListener("change", _borderPolicyChangeHandler);
        this.flux.store("tool").removeListener("change", _borderPolicyChangeHandler);

        _currentTransformPolicyID = null;

        return Promise.resolve();
    };
    onReset.action = {
        modal: true,
        reads: [],
        writes: []
    };

    exports.changeVectorMaskMode = changeVectorMaskMode;
    exports.installShapeDefaults = installShapeDefaults;
    exports.resetBorderPolicies = resetBorderPolicies;
    exports.select = selectTool;
    exports.swapPolicies = swapPolicies;
    exports.initTool = initTool;
    exports.handleToolModalStateChanged = handleToolModalStateChanged;
    exports.changeModalState = changeModalState;
    exports.enterPathModalState = enterPathModalState;

    exports.beforeStartup = beforeStartup;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;

    exports._priority = 0;
});
