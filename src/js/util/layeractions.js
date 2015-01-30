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

    var _ = require("lodash"),
        Immutable = require("immutable"),
        Promise = require("bluebird");

    var descriptor = require("adapter/ps/descriptor"),
        documentLib = require("adapter/lib/document"),
        layerLib = require("adapter/lib/layer");

    var log = require("js/util/log"),
        lockingUtil = require("js/util/locking");

    
    /**
     * Helper function to parse the response of the full composite batch of actions.
     * Uses the supplied reverseIndex to determine to which layerAction the response element should map
     * 
     * @private
     * @param {Array.<Object>} responseArray array of all response objects from photoshop
     * @param {Array.<{layer: Layer, action: PlayObject | Array.<PlayObject>}>} layerActions 
     * @param {Array.<number>} reverseIndex maps a response element to its original request index
     *
     * @return {Array.<object>} layerActions cloned, including an additional response property (object or array)
     */
    var _handleCompositeResponse = function (responseArray, layerActions, reverseIndex) {
        // make a deep clone to avoid side effects
        var newLayerActions = _.cloneDeep(layerActions);

        responseArray.forEach(function (response, index) {
            var destinationIndex = reverseIndex[index];

            // discard the -1 values, those are related to selection actions
            if (destinationIndex >= 0) {
                if (!_.has(newLayerActions, destinationIndex)) {
                    throw new Error ("Could not find index " + destinationIndex + " in layerActions");
                }
                var layerAction = newLayerActions[destinationIndex];
                if (_.isArray(layerAction.action)) {
                    layerAction.response = layerAction.response ? layerAction.response : [];
                    layerAction.response.push(response);
                } else {
                    if (layerAction.response) {
                        log.warn("layerAction has a singular action, but more than one response detected");
                    }
                    layerAction.response = response;
                }
            }
        });

        return newLayerActions;
    };


    /**
     * Play a set of layer-specific actions, but first including a 'select' action 
     * immediately prior to each layer's given actions.
     * A final action descriptor is appended which restores the original selection
     * NOTE: a successfully resolved response will always be an array.
     *
     * @param {Document} document document
     * @param {Array.<{layer: Layer, action: PlayObject | Array.<PlayObject>}>} layerActions layer-actions to execute
     * @param {boolean=} lockSafe if true, use locking utility's lockSafePlay.  default = false
     * @return {Promise.Array.<object>} A copy of the provided layerActions including an additional response property
     */
    var playLayerActions = function (document, layerActions, lockSafe) {
        // document ref to be used throughout
        var documentRef = documentLib.referenceBy.id(document.id),
            reverseIndex = [];

        // Iterate over the given layerActions and produce the full set of actions to play
        var superActions = layerActions.reduce(function (reduction, layerAction, index) {
            var layerRef = layerLib.referenceBy.id(layerAction.layer.id);

            // add and action to select this layer
            reduction.push(layerLib.select([documentRef, layerRef]));
            // use -1 to denote that this is a selection-specific action, the response of which can be discarded
            reverseIndex.push(-1);

            // add the original action or actions, and update the reverseIndex
            if (_.isArray(layerAction.action)) {
                layerAction.action.forEach(function (action) {
                    reduction.push(action);
                    reverseIndex.push(index);
                });
            } else {
                reduction.push(layerAction.action);
                reverseIndex.push(index);
            }
            return reduction;
        }, []);

        // Build a selection action to re-select all the originally selected layers
        var allLayerRefs = document.layers.selected.map(function (layer) {
            return layerLib.referenceBy.id(layer.id);
        });
        superActions.push(layerLib.select(allLayerRefs.unshift(documentRef).toArray()));
        reverseIndex.push(-1);

        // Play it, and then smartly parse the responses into a clone of the layerActions
        // Based on the lockSafe parameter, call the appropriate batchPlay
        var superPromise;
        if (lockSafe) {
            superPromise = lockingUtil.lockSafePlay(document,
                Immutable.List(_.pluck(layerActions, "layer")), superActions);
        } else {
            superPromise = descriptor.batchPlayObjects(superActions);
        }

        return superPromise.then(function (responseArray) {
                // rudimentary response validation
                if (responseArray.length !== reverseIndex.length) {
                    return Promise.reject("Failed during selection dance");
                }
                return _handleCompositeResponse(responseArray, layerActions, reverseIndex);
            });
    };

    /**
     * Play the same action for each layer in the provided list by first selecting the layer, playing the action,
     * and finally re-selected all originally selected layers.  
     * This is just a simplified case of the more general `playLayerActions`
     *
     * @param {Document} document document
     * @param {Immutable.List.<Layer>} layers list of layers to act upon
     * @param {PlayObject | Array.<PlayObject>} action action(s) to play on each layer
     * @param {boolean=} lockSafe if true, use locking utility's lockSafePlay.  default = false
     * @return {Promise} returns the photoshop response from the first played action(s)
     */
    var playSimpleLayerActions = function (document, layers, action, lockSafe) {
        var layerActions = layers.map(function (layer) {
            return {
                layer: layer,
                action: action
            };
        }).toArray();

        return playLayerActions(document, layerActions, lockSafe)
            .then(function (responseArray) {
                return _.first(responseArray).response;
            });
    };

    exports.playLayerActions = playLayerActions;
    exports.playSimpleLayerActions = playSimpleLayerActions;
});
