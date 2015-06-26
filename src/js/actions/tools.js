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

    var Promise = require("bluebird");

    var descriptor = require("adapter/ps/descriptor"),
        toolLib = require("adapter/lib/tool"),
        layerLib = require("adapter/lib/layer"),
        documentLib = require("adapter/lib/document"),
        adapterOS = require("adapter/os"),
        adapterUI = require("adapter/ps/ui"),
        adapterPS = require("adapter/ps");

    var events = require("../events"),
        locks = require("js/locks"),
        policy = require("./policy"),
        shortcuts = require("./shortcuts"),
        EventPolicy = require("js/models/eventpolicy"),
        PointerEventPolicy = EventPolicy.PointerEventPolicy;

    /**
     * Every time the layer selection / location changes, 
     * we create a border policy around the selection marquee (resetBorderPolicies)
     * This allows us to send mouse events to Photoshop for on canvas transforms
     * We store the policy ID in this variable so we can uninstall the last ones
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
    installShapeDefaults.reads = [locks.PS_DOC, locks.JS_DOC];
    installShapeDefaults.writes = [locks.PS_DOC, locks.JS_DOC];

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
            nextToolPointerPolicyList = nextTool ? nextTool.pointerPolicyList : [],
            previousToolKeyboardPolicyListID = toolStore.getCurrentKeyboardPolicyID(),
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
                var psToolName = nextTool.nativeToolName,
                    setToolPlayObject = toolLib.setTool(psToolName);

                // Set the new native tool
                return descriptor.playObject(setToolPlayObject);
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
            });
    };
    selectTool.reads = [locks.JS_APP, locks.JS_TOOL, locks.JS_SHORTCUT, locks.PS_DOC, locks.JS_DOC];
    selectTool.writes = [locks.PS_APP, locks.JS_POLICY, locks.PS_TOOL, locks.JS_TOOL, locks.JS_SHORTCUT,
            locks.PS_DOC, locks.JS_DOC];

    /**
     * If current tool is superselect, we reselect it to re-set it's scroll policies
     * Currently this action is called by window "resize" listener
     *
     * @return {Promise} Resolves to superselect tool select
     */
    var resetSuperselect = function () {
        var toolStore = this.flux.store("tool"),
            currentTool = toolStore.getCurrentTool();

        // We only want to reset superselect tool
        if (!currentTool || currentTool.id !== "newSelect") {
            return Promise.resolve();
        }

        return this.transfer(selectTool, toolStore.getToolByID("newSelect"));
    };
    resetSuperselect.reads = [locks.JS_APP, locks.JS_TOOL, locks.JS_SHORTCUT, locks.PS_DOC, locks.JS_DOC];
    resetSuperselect.writes = [locks.PS_APP, locks.JS_POLICY, locks.PS_TOOL, locks.JS_TOOL, locks.JS_SHORTCUT,
            locks.PS_DOC, locks.JS_DOC];

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
            uiStore = this.flux.store("ui"),
            currentDocument = appStore.getCurrentDocument(),
            currentPolicy = _currentTransformPolicyID,
            currentTool = toolStore.getCurrentTool();

        // We only want to reset superselect tool
        if (!currentDocument || !currentTool || currentTool.id !== "newSelect") {
            return Promise.resolve();
        }

        var targetLayers = currentDocument.layers.selected,
            artboards = targetLayers.some(function (layer) {
                return layer.isArtboard;
            }),
            selection = currentDocument.layers.selectedAreaBounds;

        if (!selection || selection.empty) {
            if (currentPolicy) {
                _currentTransformPolicyID = null;
                return this.transfer(policy.removePointerPolicies,
                    currentPolicy, true);
            } else {
                return Promise.resolve();
            }
        }

        // Photoshop transform controls are either clickable on the corner squares for resizing
        // or in a 25 point area around them for rotating, to allow mouse clicks only in that area
        // we first create a policy covering the bigger area (width defined by offset + inset)
        // that sends all clicks to Photoshop. But to allow selection clicks to go through inside,
        // we set an inset policy over that other rectangle, creating a "frame" of mouse selection policy
        var psSelectionTL = uiStore.transformCanvasToWindow(
                selection.left, selection.top
            ),
            psSelectionBR = uiStore.transformCanvasToWindow(
                selection.right, selection.bottom
            ),
            psSelectionWidth = psSelectionBR.x - psSelectionTL.x,
            psSelectionHeight = psSelectionBR.y - psSelectionTL.y,
            // The resize rectangles are roughly 12 points radius
            inset = 12,
            // In case of artboards, we have no rotate, so we can stay within the border
            outset = artboards ? inset : 27;

        var insidePolicy = new PointerEventPolicy(adapterUI.policyAction.NEVER_PROPAGATE,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                {}, // no modifiers inside
                {
                    x: psSelectionTL.x + inset,
                    y: psSelectionTL.y + inset,
                    width: psSelectionWidth - inset * 2,
                    height: psSelectionHeight - inset * 2
                }
            ),
            outsidePolicy = new PointerEventPolicy(adapterUI.policyAction.ALWAYS_PROPAGATE,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                {},
                {
                    x: psSelectionTL.x - outset,
                    y: psSelectionTL.y - outset,
                    width: psSelectionWidth + outset * 2,
                    height: psSelectionHeight + outset * 2
                }
            ),
            outsideShiftPolicy = new PointerEventPolicy(adapterUI.policyAction.ALWAYS_PROPAGATE,
                adapterOS.eventKind.LEFT_MOUSE_DOWN,
                {
                    shift: true
                },
                {
                    x: psSelectionTL.x - outset,
                    y: psSelectionTL.y - outset,
                    width: psSelectionWidth + outset * 2,
                    height: psSelectionHeight + outset * 2
                }
            );

        var pointerPolicyList = [
            insidePolicy,
            outsidePolicy,
            outsideShiftPolicy
        ];
        
        var removePromise;
        if (currentPolicy) {
            _currentTransformPolicyID = null;
            removePromise = this.transfer(policy.removePointerPolicies,
                currentPolicy, false);
        } else {
            removePromise = Promise.resolve();
        }

        return removePromise.bind(this).then(function () {
            return this.transfer(policy.addPointerPolicies, pointerPolicyList);
        }).then(function (policyID) {
            _currentTransformPolicyID = policyID;
        });
    };
    resetBorderPolicies.reads = [locks.JS_APP, locks.JS_TOOL];
    resetBorderPolicies.writes = [locks.PS_APP, locks.JS_POLICY];

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
    initTool.reads = [locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL, locks.JS_SHORTCUT];
    initTool.writes = [locks.PS_APP, locks.JS_POLICY, locks.PS_TOOL, locks.JS_TOOL, locks.JS_SHORTCUT];

    /**
     * Notify the stores of the modal state change
     * 
     * @param {boolean} modalState
     * @return {Promise}
     */
    var changeModalState = function (modalState) {
        var toolPromise = this.dispatchAsync(events.tool.MODAL_STATE_CHANGE, {
                modalState: modalState
            }),
            overlayPromise = this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, {
                enabled: !modalState
            });
        
        return Promise.join(toolPromise, overlayPromise);
    };
    changeModalState.reads = [locks.JS_APP];
    changeModalState.writes = locks.ALL_PS_LOCKS.concat([locks.JS_TOOL, locks.JS_DOC]);
    changeModalState.modal = true;

    /**
     * Event handler initialized in beforeStartup.
     *
     * @private
     * @type {function()}
     */
    var _toolModalStateChangedHandler;
    
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
        _toolModalStateChangedHandler = function (event) {
            var modalState = (event.state._value === "enter"),
                modalPromise = this.flux.actions.tools.changeModalState(modalState);

            if (event.kind._value === "mouse") {
                if (!modalState) {
                    // HACK - Delay is introduced here to make sure that bounds update
                    // before we redraw the overlay and to prevent that flash during successful
                    // drags
                    modalPromise
                        .delay(100)
                        .bind(this)
                        .then(function () {
                            this.dispatchAsync(events.ui.TOGGLE_OVERLAYS, { enabled: true });
                        });
                }

                // During artboard transforms, PS switches to artboard tool, so switch back to superselect
                if (event.tool && event.tool.ID === "ArtT") {
                    this.flux.actions.ui.cloak();

                    if (!modalState) {
                        this.flux.actions.tools.resetSuperselect();
                    }
                }
            }
        }.bind(this);
        descriptor.addListener("toolModalStateChanged", _toolModalStateChangedHandler);

        // Setup tool activation keyboard shortcuts
        var shortcutPromises = tools.reduce(function (promises, tool) {
            var activationKey = tool.activationKey;

            if (!activationKey) {
                return promises;
            }

            var activateTool = function () {
                var applicationStore = flux.store("application"),
                    currentDocument = applicationStore.getCurrentDocument();

                // Only select if it's not the case that the current document is unsupported
                if (!currentDocument || !currentDocument.unsupported) {
                    flux.actions.tools.selectTool(tool);
                }
            };

            var promise = this.transfer(shortcuts.addShortcut, activationKey, {}, activateTool);

            promises.push(promise);

            // Add U as another shortcut for rectangle tool, hidden in here for now
            // FIXME: Change tool architecture to support multiple shortcuts for 1.1 - Barkin
            if (tool.id === "rectangle") {
                var extraPromise = this.transfer(shortcuts.addShortcut, "U", {}, activateTool);
                promises.push(extraPromise);
            }

            return promises;
        }.bind(this), []);

        var endModalPromise = adapterPS.endModalToolState(true);

        // Initialize the current tool
        var initToolPromise = this.transfer(initTool),
            shortcutsPromise = Promise.all(shortcutPromises);

        return Promise.join(endModalPromise, initToolPromise, shortcutsPromise)
            .bind(this)
            .then(function () {
                return this.transfer(changeModalState, false);
            });
    };
    beforeStartup.modal = true;
    beforeStartup.reads = [locks.JS_APP, locks.PS_TOOL, locks.JS_TOOL];
    beforeStartup.writes = locks.ALL_PS_LOCKS.concat([locks.JS_TOOL, locks.JS_DOC, locks.JS_SHORTCUT, locks.JS_POLICY]);

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        descriptor.removeListener("toolModalStateChanged", _toolModalStateChangedHandler);

        return Promise.resolve();
    };
    onReset.modal = true;
    onReset.reads = [];
    onReset.writes = [];

    exports.installShapeDefaults = installShapeDefaults;
    exports.resetSuperselect = resetSuperselect;
    exports.resetBorderPolicies = resetBorderPolicies;
    exports.selectTool = selectTool;
    exports.initTool = initTool;
    exports.changeModalState = changeModalState;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;


    // This module must have a higher priority than the document module to avoid
    // duplicate current-document updates on startup, but lower priority than the
    // ui module so that defaults, which tool select handlers rely on, can be set.
    exports._priority = 0;
});
