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
        adapterOS = require("adapter").os,
        adapterUI = require("adapter").ps.ui,
        adapterPS = require("adapter").ps,
        UI = require("adapter").ps.ui,
        OS = require("adapter").os,
        vectorMaskLib = require("adapter").lib.vectorMask;

    var events = require("../events"),
        guides = require("./guides"),
        layers = require("./layers"),
        locks = require("js/locks"),
        policy = require("./policy"),
        ui = require("./ui"),
        shortcuts = require("./shortcuts"),
        strings = require("i18n!nls/strings"),
        layerActionsUtil = require("js/util/layeractions"),
        system = require("js/util/system"),
        headlights = require("js/util/headlights"),
        utilShortcuts = require("js/util/shortcuts"),
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
    installShapeDefaults.reads = [locks.JS_APP, locks.JS_DOC];
    installShapeDefaults.writes = [locks.PS_TOOL, locks.PS_DOC];
    installShapeDefaults.modal = true;

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

        var insidePolicy = new PointerEventPolicy(adapterUI.policyAction.PROPAGATE_TO_BROWSER,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                {}, // no modifiers inside
                innerRect
            ),
            insideCommandPolicy = new PointerEventPolicy(adapterUI.policyAction.PROPAGATE_TO_BROWSER,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                distortModifier,
                innerRect
            ),
            insideShiftPolicy = new PointerEventPolicy(adapterUI.policyAction.PROPAGATE_TO_BROWSER,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                { shift: true },
                innerRect
            ),
            // Used for distort/skew transformations
            noOutsetCommandPolicy = new PointerEventPolicy(adapterUI.policyAction.PROPAGATE_BY_ALPHA,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                distortModifier,
                middleRect
            ),
            // Used for proportional resize
            noOutsetShiftPolicy = new PointerEventPolicy(adapterUI.policyAction.PROPAGATE_BY_ALPHA,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                { shift: true },
                middleRect
            ),
            // Used for proportional distort/skew
            noOutsetCommandShiftPolicy = new PointerEventPolicy(adapterUI.policyAction.PROPAGATE_BY_ALPHA,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                _.merge({ shift: true }, distortModifier),
                middleRect
            ),
            // Used for rotation
            outsidePolicy = new PointerEventPolicy(adapterUI.policyAction.PROPAGATE_BY_ALPHA,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                {},
                outerRect
            ),
            // Used for constrained rotation
            outsideShiftPolicy = new PointerEventPolicy(adapterUI.policyAction.PROPAGATE_BY_ALPHA,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                { shift: true },
                outerRect
            );

        var pointerPolicyList = [
            insidePolicy,
            insideCommandPolicy,
            insideShiftPolicy,
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
            return Promise.resolve();
        }

        // Make sure to always remove the remaining policies
        if (!currentDocument || !currentTool || currentTool.id !== "newSelect") {
            _currentTransformPolicyID = null;
            guidePromise = this.transfer(guides.resetGuidePolicies);

            return Promise.join(removePromise, guidePromise);
        }

        var targetLayers = currentDocument.layers.selected,
            overallSelection = currentDocument.layers.selectedAreaBounds;

        // If selection is empty, remove existing policy
        if (!overallSelection || overallSelection.empty) {
            _currentTransformPolicyID = null;
            guidePromise = this.transfer(guides.resetGuidePolicies);

            return Promise.join(removePromise, guidePromise);
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
    resetBorderPolicies.reads = [locks.JS_APP, locks.JS_DOC, locks.JS_TOOL, locks.JS_UI];
    resetBorderPolicies.writes = [];
    resetBorderPolicies.transfers = [
        policy.removePointerPolicies,
        policy.addPointerPolicies,
        guides.resetGuidePolicies
    ];
    resetBorderPolicies.modal = true;

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
    var _swapPolicies = function (nextTool) {
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
                previousToolKeyboardPolicyListID, false); // delay commit
        } else {
            removeKeyboardPolicyPromise = Promise.resolve();
        }

        var swapKeyboardPolicyPromise = removeKeyboardPolicyPromise
            .bind(this)
            .then(function () {
                return this.transfer(policy.addKeyboardPolicies, nextToolKeyboardPolicyList);
            });
        
        // Swap pointer policy
        var removePointerPolicyPromise;
        if (previousToolPointerPolicyListID !== null) {
            removePointerPolicyPromise = this.transfer(policy.removePointerPolicies,
                previousToolPointerPolicyListID, false); // delay commit
        } else {
            removePointerPolicyPromise = Promise.resolve();
        }

        var swapPointerPolicyPromise = removePointerPolicyPromise
            .bind(this)
            .then(function () {
                return this.transfer(policy.addPointerPolicies, nextToolPointerPolicyList);
            });

        return Promise.join(swapKeyboardPolicyPromise, swapPointerPolicyPromise,
            function (nextToolKeyboardPolicyListID, nextToolPointerPolicyListID) {
                return {
                    tool: nextTool,
                    keyboardPolicyListID: nextToolKeyboardPolicyListID,
                    pointerPolicyListID: nextToolPointerPolicyListID
                };
            }.bind(this));
    };

    /**
     * Activates a logical tool
     *
     * @param {Tool} nextTool
     * @return {Promise} Resolves to tool change
     */
    var selectTool = function (nextTool) {
        var toolStore = this.flux.store("tool");

        // Set the appropriate Photoshop tool and tool options
        return adapterPS.endModalToolState(true)
            .bind(this)
            // Remove the border policy if it's been set at some point
            .then(function () {
                if (_currentTransformPolicyID) {
                    var policyID = _currentTransformPolicyID;
                    _currentTransformPolicyID = null;
                    return this.transfer(policy.removePointerPolicies, policyID, false);
                }
            })
            .then(function () {
                var currentTool = toolStore.getCurrentTool();

                if (!currentTool || !currentTool.deselectHandler) {
                    return;
                }
                // Calls the deselect handler of last tool
                return currentTool.deselectHandler.call(this, currentTool);
            })
            .then(function () {
                var psToolName = nextTool.nativeToolName.call(this),
                    setToolPlayObject = toolLib.setTool(psToolName);

                // Set the new native tool
                return descriptor.playObject(setToolPlayObject);
            })
            .then(function () {
                if (!nextTool.handleVectorMaskMode) {
                    return this.dispatch(events.tool.VECTOR_MASK_MODE_CHANGE, false);
                }
                return Promise.resolve();
            })
            .then(function () {
                var selectHandler = nextTool.selectHandler;

                if (!selectHandler) {
                    return;
                }

                // Calls the select handler of new tool
                return selectHandler.call(this, nextTool);
            })
            .then(function () {
                return adapterOS.resetCursor();
            })
            .then(function () {
                return _swapPolicies.call(this, nextTool);
            })
            .then(function (result) {
                // After setting everything, dispatch to stores
                this.dispatch(events.tool.SELECT_TOOL, result);

                if (!toolStore.getVectorMode() || !nextTool.handleVectorMaskMode) {
                    return this.transfer(resetBorderPolicies);
                }
            });
    };
    selectTool.reads = [];
    selectTool.writes = [locks.JS_TOOL, locks.PS_TOOL];
    selectTool.transfers = [resetBorderPolicies, installShapeDefaults, shortcuts.addShortcut,
        shortcuts.removeShortcut, "layers.deleteSelected", "layers.resetLayers",
        policy.removePointerPolicies, policy.removeKeyboardPolicies, policy.addPointerPolicies,
        policy.addKeyboardPolicies, policy.setMode];
    selectTool.modal = true;

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
            })
            .catch(function (err) {
                var defaultTool = toolStore.getDefaultTool();
                if (tool === defaultTool) {
                    throw err;
                }

                return this.transfer(selectTool, defaultTool);
            });
    };
    initTool.reads = [locks.JS_TOOL];
    initTool.writes = [];
    initTool.transfers = [selectTool];

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
    changeModalState.reads = [];
    changeModalState.writes = [locks.JS_TOOL];
    changeModalState.modal = true;

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
            cloakPromise = this.transfer(ui.cloak);
        }

        return Promise.join(changeStatePromise, policyPromise, cloakPromise);
    };
    handleToolModalStateChanged.reads = [];
    handleToolModalStateChanged.writes = [];
    handleToolModalStateChanged.transfers = [policy.suspendAllPolicies, policy.restoreAllPolicies,
        changeModalState, "ui.cloak"];
    handleToolModalStateChanged.modal = true;

    /**
     * Event handler initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _toolModalStateChangedHandler,
        _vectorMaskHandler,
        _vectorSelectMaskHandler;

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
            return Promise.resolve();
        }

        var currentLayers = currentDocument.layers.selected,
            currentLayer = currentLayers.first();

        // vector mask mode requires an active layer
        if (!currentLayer) {
            if (vectorMaskMode) {
                return Promise.resolve();
            } else {
                return this.dispatchAsync(events.tool.VECTOR_MASK_MODE_CHANGE, vectorMaskMode);
            }
        }

        var nonVectorModeLayer = (currentLayer.kind === currentLayer.layerKinds.BACKGROUND ||
                currentLayer.kind === currentLayer.layerKinds.VECTOR) ||
                currentLayer.locked;

        if (vectorMaskMode && nonVectorModeLayer) {
            return Promise.resolve();
        }

        var initPromise,
            dispatchPromise,
            removePromise,
            policyPromise,
            createMaskOptions = {
                historyStateInfo: {
                    name: strings.ACTIONS.ADD_VECTOR_MASK,
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
                    vectorMaskEnabled: true
                },
                dispatchAdd = this.dispatchAsync(events.document.history.optimistic.ADD_VECTOR_MASK_TO_LAYER, payload),
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
        } else {
            // delete empty masks when leaving mask mode
            removePromise = this.transfer(layers.resetLayers, currentDocument, currentLayer)
                .bind(this)
                .then(function () {
                    currentLayer = appStore.getCurrentDocument().layers.selected.first();

                    if (currentLayer.vectorMaskEnabled && currentLayer.vectorMaskEmpty) {
                        var deleteMaskOptions = {
                            historyStateInfo: {
                                name: strings.ACTIONS.DELETE_VECTOR_MASK,
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
                                        vectorMaskEnabled: false
                                    },
                                    event = events.document.history.optimistic.REMOVE_VECTOR_MASK_FROM_LAYER;

                                return this.dispatchAsync(event, payload);
                            });
                    } else {
                        return Promise.resolve();
                    }
                });

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
                    removePromise);
            } else if (!vectorMaskMode) {
                return Promise.join(initPromise, resetPromise, dispatchPromise, policyPromise, removePromise);
            } else {
                return Promise.join(initPromise, resetPromise, dispatchPromise, policyPromise, removePromise)
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
        } else if (currentTool.id === "newSelect" || currentTool.id === "superselectVector") {
            if (!vectorMaskMode) {
                return this.transfer(selectTool, toolStore.getToolByID("newSelect"))
                .then(function () {
                    return Promise.join(initPromise, dispatchPromise, policyPromise, removePromise);
                });
            } else {
                return this.transfer(selectTool, toolStore.getToolByID("superselectVector"))
                .then(function () {
                    return Promise.join(initPromise, dispatchPromise, policyPromise, removePromise);
                })
                .bind(this)
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

        headlights.logEvent("tools", "mask-mode", String(currentLayer.kind));
    };
    changeVectorMaskMode.reads = [locks.JS_APP, locks.JS_TOOL, locks.PS_DOC, locks.PS_TOOL];
    changeVectorMaskMode.writes = [locks.JS_TOOL, locks.PS_DOC];
    changeVectorMaskMode.modal = true;
    changeVectorMaskMode.transfers = [selectTool, policy.addPointerPolicies, policy.removePointerPolicies,
        installShapeDefaults, "layers.resetLayers"];

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
    enterPathModalState.reads = [];
    enterPathModalState.writes = [];
    enterPathModalState.modal = true;

    /**
     * Register event listeners for native tool selection change events, register
     * tool keyboard shortcuts, and initialize the currently selected tool.
     * 
     * @return {Promise}
     */
    var beforeStartup = function () {
        var flux = this.flux,
            toolStore = this.flux.store("tool"),
            tools = toolStore.getAllTools();

        // Listen for modal tool state entry/exit events
        _toolModalStateChangedHandler = this.flux.actions.tools.handleToolModalStateChanged.bind(this);
        descriptor.addListener("toolModalStateChanged", _toolModalStateChangedHandler);

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
                fn: activateTool
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
            fn: _vectorMaskHandler
        });

        _vectorSelectMaskHandler = function () {
            if (toolStore.getVectorMode()) {
                flux.actions.tools.select(toolStore.getToolByID("superselectVector"));
            }
        }.bind(this);

        shortcutSpecs.push({
            key: utilShortcuts.GLOBAL.TOOLS.VECTOR_SELECT,
            modifiers: {},
            fn: _vectorSelectMaskHandler
        });

        var shortcutsPromise = this.transfer(shortcuts.addShortcuts, shortcutSpecs),
            endModalPromise = adapterPS.endModalToolState(true),
            initToolPromise = this.transfer(initTool); // Initialize the current tool

        return Promise.join(endModalPromise, initToolPromise, shortcutsPromise)
            .bind(this)
            .then(function () {
                return this.transfer(changeModalState, false);
            });
    };
    beforeStartup.modal = true;
    beforeStartup.reads = [locks.JS_APP, locks.JS_TOOL];
    beforeStartup.writes = [locks.PS_TOOL];
    beforeStartup.transfers = [shortcuts.addShortcuts, initTool, changeModalState, changeVectorMaskMode];

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);

        _currentTransformPolicyID = null;

        return Promise.resolve();
    };
    onReset.modal = true;
    onReset.reads = [];
    onReset.writes = [];

    exports.changeVectorMaskMode = changeVectorMaskMode;
    exports.installShapeDefaults = installShapeDefaults;
    exports.resetBorderPolicies = resetBorderPolicies;
    exports.select = selectTool;
    exports.initTool = initTool;
    exports.handleToolModalStateChanged = handleToolModalStateChanged;
    exports.changeModalState = changeModalState;
    exports.enterPathModalState = enterPathModalState;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;

    exports._priority = 0;
});
