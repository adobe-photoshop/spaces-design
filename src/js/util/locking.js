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
     * Play an action descriptor in a "lock safe" way.  This means that the action will be called within batch
     * and sandwiched between two descriptors. The first will unlock necessary layers, 
     * and the second will re-lock afterwards.
     *
     * @param {Document} document document
     * @param {Immutable.List.<Layer>} layers set of layers on which this action acts
     * @param {PlayObject | Array.<PlayObject>} action PlayObject(s) to play
     * @param {Object=} options optional adapter play options
     * @return {Promise}
     */
    var lockSafePlay = function (document, layers, action, options) {
        var lockedLayers = _getLayersToUnlock(document, layers),
            actionIsArray = _.isArray(action),
            actions = actionIsArray ? action : [action];

        // If there are no locked layers, just execute vanilla descriptor playObject (or batchPlayObjects)
        if (lockedLayers.isEmpty()) {
            if (actionIsArray) {
                return descriptor.batchPlayObjects(actions);
            } else {
                return descriptor.playObject(action);
            }
        }

        // prepend an unlock command 
        actions.unshift(_layerLocking(document, lockedLayers, false));
        // append a re-lock
        actions.push(_layerLocking(document, lockedLayers, true));

        return descriptor.batchPlayObjects(actions, options)
            .then(function (responseArray) {
                // Validate the repsonseArray is the right size, and is bookended with layerLocking responses
                if ((responseArray.length === actions.length) &&
                    _.has(_.first(responseArray), "layerLocking") &&
                    _.has(_.last(responseArray), "layerLocking")) {

                    // strip off the extraneous first and last response elements caused by this locking dance
                    var strippedResponse = _.rest(_.initial(responseArray));
                    // return this, or the first element if only a singular action was supplied 
                    return actionIsArray ? strippedResponse : strippedResponse[0];

                } else {
                    Promise.reject(new Error("Failed to play actions while temporarily unlocking layers"));
                }
            });
    };

    exports.lockSafePlay = lockSafePlay;
});
