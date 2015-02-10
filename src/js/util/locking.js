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

    var collection = require("js/util/collection");

    /**
     * Find a set of layers that will need to be unlocked in order to operate on the given set of layers
     * This includes traversing up and down the hierarchy to find locked layers
     * 
     * @private
     * @param {Document} document document to be operated on
     * @param {Immutable.List.<Layer>} layers set of layers that are intended to be operated upon
     * @return {Immutable.List.<Layer>}
     */
    var _getLayersToUnlock = function (document, layers) {
        return layers.reduce(
            function (layerSet, layer) {
                return layerSet
                    // include locked ancestors
                    .union(document.layers.lockedAncestors(layer))
                    // include locked descendants 
                    .union(document.layers.lockedDescendants(layer));
            },
            Immutable.OrderedSet()
        );
    };

    /**
     * Gets the set of layers that are currently hidden
     * Ancestors/descendants are not needed to be edited
     *
     * @private
     * @param {Document} document [description]
     * @param {Immutable.List.<Layer>} layers set of layers that are intended to be operated upon
     * @return {Immutable.List.<Layer>} Subset of layers that are hidden
     */
    var _getLayersToShow = function (document, layers) {
        return layers.filterNot(function (layer) {
            return layer.visible;
        });
    };

    /**
     * Create a PlayObject to either lock or unlock a set of layers via the playground adapter
     * 
     * @private
     * @param {Document} document document
     * @param {Immutable.List.<Layer>} layers set of layers
     * @param {boolean} lock if true, lock the given layers, otherwise unlock
     * @return {playObject}
     */
    var _layerLocking = function (document, layers, lock) {
        var layerIDs = collection.pluck(layers, "id").toArray(),
            refs = layerLib.referenceBy.id(layerIDs),
            docRef = documentLib.referenceBy.id(document.id);

        refs.ref.push(docRef);
        return layerLib.setLocking(refs, lock);
    };

    /**
     * Create a play object to either show or hide a set of layers
     *
     * @private
     * @param {Document} document
     * @param {Immutable.List.<Layer>} layers
     * @param {boolean} hide Hide if true, show if false
     *
     * @return {[type]} [description]
     */
    var _layerHiding = function (document, layers, hide) {
        var layerIDs = collection.pluck(layers, "id").toArray(),
            refs = layerLib.referenceBy.id(layerIDs),
            docRef = documentLib.referenceBy.id(document.id);

        refs.ref.push(docRef);
        if (hide) {
            return layerLib.hide(refs);
        } else {
            return layerLib.show(refs);
        }
    };

    /**
     * Play an action descriptor in a "lock safe" way.
     * This means that the action will be called within batch
     * and sandwiched between two descriptors. 
     * The first will unlock and show necessary layers, 
     * and the second will re-lock and re-hide afterwards.
     *
     * @param {Document} document document
     * @param {Immutable.List.<Layer>} layers set of layers on which this action acts
     * @param {PlayObject | Array.<PlayObject>} action PlayObject(s) to play
     * @param {object=} options optional adapter play options
     * @return {Promise}
     */
    var playWithLockOverride = function (document, layers, action, options) {
        var lockedLayers = _getLayersToUnlock(document, layers),
            hiddenLayers = _getLayersToShow(document, layers),
            actionIsArray = _.isArray(action),
            actions = actionIsArray ? action : [action],
            noLocked = lockedLayers.isEmpty(),
            noHidden = hiddenLayers.isEmpty(),
            extraCalls = (noLocked ? 0 : 1) + (noHidden ? 0 : 1); // How many calls we're adding at both ends

        // If there are no locked/hidden layers, just execute vanilla descriptor play objects
        if (noLocked && noHidden) {
            if (actionIsArray) {
                return descriptor.batchPlayObjects(actions, options);
            } else {
                return descriptor.playObject(action, options);
            }
        }

        // Put show/hide commands around
        if (!noHidden) {
            actions.unshift(_layerHiding(document, hiddenLayers, false));
            actions.push(_layerHiding(document, hiddenLayers, true));
        }
        // Then put lock commands around, so they get played first/last
        if (!noLocked) {
            actions.unshift(_layerLocking(document, lockedLayers, false));
            actions.push(_layerLocking(document, lockedLayers, true));
        }
        
        return descriptor.batchPlayObjects(actions, options)
            .then(function (responseArray) {
                // Validate the responseArray is the right size
                if (responseArray.length === actions.length) {
                    // strip off the extraneous first two and last two response elements caused by this locking dance
                    var strippedResponse = responseArray.slice(extraCalls, responseArray.length - extraCalls);
                    // return this, or the first element if only a singular action was supplied 
                    return actionIsArray ? strippedResponse : strippedResponse[0];

                } else {
                    Promise.reject(new Error("Failed to play actions while temporarily unlocking and showing layers"));
                }
            });
    };

    exports.playWithLockOverride = playWithLockOverride;
});
