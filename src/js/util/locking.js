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
        Immutable = require("immutable");

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
     * @param {PlayObject | Array.<PlayObject>} actions PlayObject(s) to play
     * @return {Promise}
     */
    var lockSafePlay = function (document, layers, actions) {
        var lockedLayers = _getLayersToUnlock(document, layers),
            playObjects = _.isArray(actions) ? actions : [actions];

        // If there are no locked layers, just execute vanilla batchPlayObjects
        if (lockedLayers.isEmpty()) {
            return descriptor.batchPlayObjects(playObjects);
        }

        // prepend an unlock command 
        playObjects.unshift(_layerLocking(document, lockedLayers, false));
        // append a re-lock
        playObjects.push(_layerLocking(document, lockedLayers, true));

        return descriptor.batchPlayObjects(playObjects)
            .then(function (responseArray) {
                // strip off the extraneous first and last response elements caused by this locking dance
                // TODO Probably should do some cursory validation to make sure the response was not a blatant error
                return _.rest(_.initial(responseArray));
            });
    };

    exports.lockSafePlay = lockSafePlay;
});
