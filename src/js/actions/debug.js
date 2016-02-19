/*
 * Copyright (c) 2016 Adobe Systems Incorporated. All rights reserved.
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

    var log = require("js/util/log"),
        locks = require("js/locks");

    /**
     * Highlight descritor in the console that take longer than the specific time (ms) to complete.
     * 
     * @const
     * @type {number}
     */
    var SLOW_DESCRIPTOR = 100;

    /**
     * Temporary helper function to easily open the testrunner. This should
     * eventually replaced with a action that opens the testrunner in a new
     * window.
     */
    var runTests = function () {
        var href = window.location.href,
            baseHref = href.substring(0, href.lastIndexOf("src/index.html")),
            testHref = baseHref + "test/index.html";

        window.setTimeout(function () {
            window.location.href = testHref;
        }, 0);

        return Promise.resolve();
    };
    runTests.action = {
        reads: [],
        writes: []
    };

    /**
     * An action that always fails, for testing purposes.
     *
     * @private
     * @return {Promise}
     */
    var actionFailure = function () {
        return Promise.reject(new Error("Test: action failure"));
    };
    actionFailure.action = {
        reads: [],
        writes: []
    };

    /**
     * An action with a transfer that always fails, for testing purposes.
     *
     * @private
     * @return {Promise}
     */
    var transferFailure = function () {
        return this.transfer(actionFailure)
            .catch(function () {
                // Failed transfers always cause a controller reset, so
                // catching these failures doesn't really help.
            });
    };
    transferFailure.action = {
        reads: [],
        writes: [],
        transfers: [actionFailure]
    };

    /**
     * A flag for testing purposes which, if set, will cause onReset to fail.
     * 
     * @private
     * @type {boolean}
     */
    var _failOnReset = false;

    /**
     * An action that always fails, for testing purposes, and which causes onReset
     * to fail as well.
     *
     * @private
     * @return {Promise}
     */
    var resetFailure = function () {
        _failOnReset = true;
        return Promise.reject(new Error("Test: reset failure"));
    };
    resetFailure.action = {
        reads: [],
        writes: []
    };

    /**
     * An action that always fails, for testing purposes, and which causes onReset
     * to fail as well.
     *
     * @private
     * @return {Promise}
     */
    var corruptModel = function () {
        var applicationStore = this.flux.store("application"),
            documentStore = this.flux.store("document"),
            document = applicationStore.getCurrentDocument();

        if (document) {
            var index = document.layers.index,
                nextIndex = index.unshift(null),
                nextDocument = document.setIn(["layers", "index"], nextIndex);

            documentStore._openDocuments[document.id] = nextDocument;
        }

        return Promise.reject(new Error("Test: corrupt model"));
    };
    corruptModel.action = {
        reads: [],
        writes: []
    };

    /**
     * Run layer panel performance tests.   
     *
     * @private
     * @return {Promise}
     */
    var layerPanelPerformanceTest = function () {
        var flux = this.flux,
            applicationStore = flux.store("application"),
            document = applicationStore.getCurrentDocument(),
            openDocuments = applicationStore.getOpenDocuments();

        if (openDocuments.size !== 1 || !document.name.match(/vermilion/i)) {
            window.alert(
                "To run the performance test, the current document must be " +
                "the Vermilion file, and there should be only one open document");
            return Promise.resolve();
        }

        var continueTest = window.confirm("Please start the Timeline recording, and then hit OK to begin the test.");

        if (!continueTest) {
            return Promise.resolve();
        }

        // Mute the other time stamps to make the timeline cleaner.
        var timeStamp = log.timeStamp;
        log.timeStamp = _.noop;

        var layerFaceElements,
            artboardElement,
            artboardIconElement,
            artboardVisibilityElement,
            delayBetweenTest = 1500,
            artboards = document.layers.roots.map(function (root) {
                return document.layers.byID(root.id);
            });

        return flux.actions.groups.setGroupExpansion(document, artboards, true, true)
            .then(function () {
                flux.actions.layers.deselectAll(document);
            })
            .then(function () {
                layerFaceElements = window.document.querySelectorAll(".face__depth-6");
                artboardElement = window.document.querySelector(".face__depth-0");
                artboardIconElement = window.document.querySelector(".face__depth-0 .face__kind");
                artboardVisibilityElement = window.document.querySelector(".face__depth-0 .face__button_visibility");
                layerFaceElements[0].scrollIntoViewIfNeeded();
            })
            // Test Layer Selection
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Layer selection 1");
                layerFaceElements[0].click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Layer selection 2");
                layerFaceElements[1].click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Layer selection 3");
                layerFaceElements[2].click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Layer selection 4");
                layerFaceElements[3].click();
            })
            .delay(delayBetweenTest)
            // Test Art board Selection
            .then(function () {
                artboardElement.scrollIntoViewIfNeeded();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board selection 1");
                artboardElement.click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board deselection 1");
                layerFaceElements[0].click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board selection 2");
                artboardElement.click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board deselection 2");
                layerFaceElements[0].click();
            })
            .delay(delayBetweenTest)
            // Test Art board expand/collapse
            .then(function () {
                timeStamp("Art board collapse 1");
                artboardIconElement.click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board expand 1");
                artboardIconElement.click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board collapse 2");
                artboardIconElement.click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board expand 2");
                artboardIconElement.click();
            })
            .delay(delayBetweenTest)
            // Test Art board visibility
            .then(function () {
                timeStamp("Art board not-visible 1");
                artboardVisibilityElement.click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board visible 1");
                artboardVisibilityElement.click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board not-visible 2");
                artboardVisibilityElement.click();
            })
            .delay(delayBetweenTest)
            .then(function () {
                timeStamp("Art board visible 2");
                artboardVisibilityElement.click();
            })
            .delay(delayBetweenTest)
            // Done
            .finally(function () {
                timeStamp("End of test");
                log.timeStamp = timeStamp;
                window.alert("Please stop recording and check for the result");
            });
    };
    layerPanelPerformanceTest.action = {
        reads: [],
        writes: []
    };

    /**
     * Reload the page.
     *
     * @private
     * @return {Promise}
     */
    var resetRecess = function () {
        window.location.reload();
        return Promise.resolve();
    };
    resetRecess.action = {
        reads: [],
        writes: []
    };

    /**
     * Debug only method to toggle pointer policy area visualization
     *
     * @return {Promise}
     */
    var togglePolicyFrames = function () {
        var preferencesStore = this.flux.store("preferences"),
            preferences = preferencesStore.getState(),
            enabled = preferences.get("policyFramesEnabled");

        return this.transfer("preferences.setPreference", "policyFramesEnabled", !enabled);
    };
    togglePolicyFrames.action = {
        reads: [],
        writes: [locks.JS_PREF],
        transfers: ["preferences.setPreference"]
    };

    /**
     * Debug only method to toggle post condition verification
     *
     * @return {Promise}
     */
    var togglePostconditions = function () {
        var preferencesStore = this.flux.store("preferences"),
            preferences = preferencesStore.getState(),
            enabled = preferences.get("postConditionsEnabled");

        return this.transfer("preferences.setPreference", "postConditionsEnabled", !enabled);
    };
    togglePostconditions.action = {
        reads: [],
        writes: [locks.JS_PREF],
        transfers: ["preferences.setPreference"]
    };

    /**
     * Debug-only method to toggle action logging
     *
     * @return {Promise}
     */
    var toggleActionLogging = function () {
        var preferencesStore = this.flux.store("preferences"),
            preferences = preferencesStore.getState(),
            enabled = preferences.get("logActions", true);

        return this.transfer("preferences.setPreference", "logActions", !enabled);
    };
    toggleActionLogging.action = {
        reads: [],
        writes: [locks.JS_PREF],
        transfers: ["preferences.setPreference"]
    };

    /**
     * Debug-only method to toggle action transfer logging
     *
     * @return {Promise}
     */
    var toggleActionTransferLogging = function () {
        var preferencesStore = this.flux.store("preferences"),
            preferences = preferencesStore.getState(),
            enabled = preferences.get("logActionTransfers");

        return this.transfer("preferences.setPreference", "logActionTransfers", !enabled);
    };
    toggleActionTransferLogging.action = {
        reads: [],
        writes: [locks.JS_PREF],
        transfers: ["preferences.setPreference"]
    };
    
    /**
     * Debug-only method to toggle Descriptor Event logging
     * 
     * @param {object} options
     * @param {boolean} options.toggle
     * @return {Promise}
     */
    var logDescriptor = function (options) {
        options = _.merge({ toggle: true }, options);

        var preferencesStore = this.flux.store("preferences"),
            preferences = preferencesStore.getState(),
            enabled = preferences.get("descriptorLoggingEnabled"),
            descriptor = require("adapter").ps.descriptor;

        if (options.toggle) {
            enabled = !enabled;
        }

        var blockStyle = "color:gray;",
            groupStyle = "color:blue;font-weight:normal",
            redText = "color:red;font-weight:normal",
            blueText = "color:blue;font-weight:normal";

        descriptor.__getAsync = descriptor.__getAsync || descriptor._getAsync;
        descriptor.__batchPlayAsync = descriptor.__batchPlayAsync || descriptor._batchPlayAsync;
        descriptor.__eventHandler = descriptor.__eventHandler || function (eventID, obj) {
            log.debug("[Descriptor] Received PS Event: %c%s\n%c%s", "font-weight:bold", eventID, blockStyle,
                JSON.stringify(obj, null, " "));
        };

        if (enabled) {
            // Customized version of the `descriptor._getAsync` to capture the descriptor ID.
            var getAsync = Promise.promisify(function (reference, options, idCallback, callback) {
                var id = this.get(reference, options, callback);
                idCallback(id);
                return id;
            }, {
                context: window._spaces.ps.descriptor
            });
            
            descriptor._getAsync = function (reference, options) {
                var start = new Date(),
                    descriptorID;

                return getAsync(reference, options, function (id) {
                    descriptorID = id;

                    log.groupCollapsed("%c[Descriptor] Executing get - %d", groupStyle, descriptorID);
                    log.trace("Trace");
                    log.debug("Params:\n%c%s", blockStyle, JSON.stringify(reference, null, " "));
                    log.groupEnd();
                    log.timeStamp("[Descriptor] Executing get - " + descriptorID);
                }).then(function (result) {
                    var end = new Date();

                    log.groupCollapsed("%c[Descriptor] Finished get - %d in %c%dms", groupStyle,
                        descriptorID,
                        end - start > SLOW_DESCRIPTOR ? redText : blueText,
                        end - start);
                    log.debug("Result:\n%c%s", blockStyle, JSON.stringify(result, null, " "));
                    log.groupEnd();
                    log.timeStamp("[Descriptor] Finished get - " + descriptorID);
                    return result;
                });
            };

            // Customized version of the `descriptor._batchPlay` to capture the descriptor ID.
            var batchPlayAsync = Promise.promisify(function (commands, options, idCallback, callback) {
                var id = this.batchPlay(commands, options, callback);
                idCallback(id);
                return id;
            }, {
                context: window._spaces.ps.descriptor,
                multiArgs: true
            });

            var summarizeCommands = function (commands) {
                if (commands.length === 0) {
                    return "";
                }

                commands = commands.map(function (c) { return c.name; });

                var lastCommand = commands[0],
                    grouppedCommands = [],
                    results = [];

                commands.forEach(function (command) {
                    if (lastCommand !== command) {
                        results.push(grouppedCommands);
                        lastCommand = command;
                        grouppedCommands = [];
                    }

                    grouppedCommands.push(command);
                });

                results.push(grouppedCommands);

                return results.map(function (grouppedCommands) {
                    return grouppedCommands.length === 1 ? grouppedCommands[0] :
                        grouppedCommands[0] + " x " + grouppedCommands.length;
                }).join(", ");
            };

            descriptor._batchPlayAsync = function (commands, options) {
                var commandNames = summarizeCommands(commands),
                    isHitTest = commandNames === "hitTest",
                    start = new Date(),
                    descriptorID;

                return batchPlayAsync(commands, options, function (id) {
                    descriptorID = id;

                    if (!isHitTest) {
                        var str = "(" + JSON.stringify(commands, null, " ") + ", " +
                            JSON.stringify(options, null, " ") + ");";

                        log.groupCollapsed("%c[Descriptor] Executing batchPlay: [%s] - %d", groupStyle,
                            commandNames, descriptorID);
                        log.trace("Trace");
                        log.debug("Params:\n%c%s", blockStyle, str);
                        log.groupEnd();
                        log.timeStamp("[Descriptor] Executing batchPlay - " + descriptorID);
                    }
                }).tap(function (result) {
                    if (!isHitTest) {
                        var end = new Date();

                        log.groupCollapsed("%c[Descriptor] Finished batchPlay: [%s] - %d in %c%dms", groupStyle,
                            commandNames,
                            descriptorID,
                            end - start > SLOW_DESCRIPTOR ? redText : blueText,
                            end - start);
                        log.debug("Result:\n%c%s", blockStyle, JSON.stringify(result, null, " "));
                        log.groupEnd();
                        log.timeStamp("[Descriptor] Finished batchPlay - " + descriptorID);
                    }
                });
            };

            descriptor.on("all", descriptor.__eventHandler);
        } else {
            descriptor._getAsync = descriptor.__getAsync;
            descriptor._batchPlayAsync = descriptor.__batchPlayAsync;
            descriptor.off("all", descriptor.__eventHandler);
        }

        return this.transfer("preferences.setPreference", "descriptorLoggingEnabled", enabled);
    };
    logDescriptor.action = {
        reads: [],
        writes: [locks.JS_PREF],
        transfers: ["preferences.setPreference"]
    };
    
    /**
     * Debug-only method to toggle Headlights logging
     * 
     * @param {object} options
     * @param {boolean} options.toggle
     * @return {Promise}
     */
    var logHeadlights = function (options) {
        options = _.merge({ toggle: true }, options);

        var preferencesStore = this.flux.store("preferences"),
            preferences = preferencesStore.getState(),
            enabled = preferences.get("headlightsLoggingEnabled"),
            headlights = require("js/util/headlights");
        
        if (options.toggle) {
            enabled = !enabled;
        }
        
        headlights.__logEvent = headlights.__logEvent || headlights.logEvent;
        
        headlights.logEvent = function (category, subcategory, event) {
            if (enabled) {
                log.debug("[Headlights] Logging: %s > %s > %s", category, subcategory, event);
            }

            return headlights.__logEvent(category, subcategory, event);
        };

        return this.transfer("preferences.setPreference", "headlightsLoggingEnabled", enabled);
    };
    logHeadlights.action = {
        reads: [],
        writes: [locks.JS_PREF],
        transfers: ["preferences.setPreference"]
    };
    
    /**
     * Debug-only method to toggle action transfer logging
     *
     * @return {Promise}
     */
    var loadDebuggingHelpers = function () {
        log.debug(["%c",
            "Loaded Debugging Helpers:",
            "",
            "_printCurrentLayerDescriptor",
            "_getFluxInstance",
            "_getCurrentDocument",
            "_getSelectedLayers"].join("\n"), "color:black;");

        _.merge(window, {
            _printCurrentLayerDescriptor: function () {
                var descriptor = require("adapter").ps.descriptor;
                descriptor.get("layer")
                    .then(function (result) {
                        return JSON.stringify(result, null, " ");
                    })
                    .then(log.debug);
            },
            _getFluxInstance: function () {
                return this.flux;
            }.bind(this),
            _getCurrentDocument: function () {
                return this.flux.stores.application.getCurrentDocument();
            }.bind(this),
            _getSelectedLayers: function () {
                return this.flux.stores.application.getCurrentDocument().layers.selected;
            }.bind(this)
        });

        return Promise.resolve();
    };
    loadDebuggingHelpers.action = {
        reads: [],
        writes: [],
        transfers: []
    };
    
    /**
     * Send info about menu commands to search store
     *
     * @return {Promise}
     */
    var beforeStartup = function () {
        var logDescriptorPromise = this.transfer("debug.logDescriptor", { toggle: false }),
            logHeadlightsPromise = this.transfer("debug.logHeadlights", { toggle: false });

        return Promise.join(logDescriptorPromise, logHeadlightsPromise);
    };
    beforeStartup.action = {
        reads: [],
        writes: [],
        transfers: ["debug.logDescriptor", "debug.logHeadlights"]
    };

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        // For debugging purposes only
        if (_failOnReset) {
            return Promise.reject();
        }

        return Promise.resolve();
    };
    onReset.action = {
        reads: [],
        writes: []
    };

    exports.runTests = runTests;
    exports.actionFailure = actionFailure;
    exports.transferFailure = transferFailure;
    exports.resetFailure = resetFailure;
    exports.corruptModel = corruptModel;
    exports.layerPanelPerformanceTest = layerPanelPerformanceTest;
    exports.resetRecess = resetRecess;
    exports.togglePolicyFrames = togglePolicyFrames;
    exports.togglePostconditions = togglePostconditions;
    exports.toggleActionLogging = toggleActionLogging;
    exports.toggleActionTransferLogging = toggleActionTransferLogging;
    exports.logDescriptor = logDescriptor;
    exports.logHeadlights = logHeadlights;
    exports.loadDebuggingHelpers = loadDebuggingHelpers;

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
