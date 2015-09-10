/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

    var Immutable = require("immutable"),
        _ = require("lodash");

    /**
     * Add a new "row" with this layer, or update an existing one if supplied
     * A row contains an array of layers, as well as max vertical bounds for the row
     *
     * @private
     * @param {Layer} layer
     * @param {object=} row Optional, merge with this row if supplied
     * @return {object} row representation
     */
    var _upsertRow = function (layer, row) {
        var bounds = layer.bounds;
        if (row) {
            row.layers.push(layer);
            row.top = Math.min(row.top, bounds.top);
            row.bottom = Math.max(row.bottom, bounds.bottom);
            return row;
        } else {
            return {
                top: bounds.top,
                bottom: bounds.bottom,
                layers: [layer]
            };
        }
    };

    /**
     * Recursively search rows to determine where the given layer's bounds fit
     * And then merge it in.
     *
     * @private
     * @param {Array.<object>} rows
     * @param {Layer} layer
     * @param {number=} index Optional. If not supplied, start at zero
     * @return {Array.<object>} rows, updated with the layer in its correct row
     */
    var _addLayerToRow = function (rows, layer, index) {
        index = index || 0;

        var row = rows[index],
            bounds = layer.bounds,
            newIndex;

        if (!row) {
            newIndex = index;
        } else if (bounds.bottom < row.top) {
            newIndex = index - 1;
        } else if (bounds.top < row.bottom && bounds.bottom > row.top) {
            newIndex = index;
        } else if (index === rows.length - 1) {
            newIndex = index + 1;
        } else {
            return _addLayerToRow(rows, layer, index + 1);
        }

        if (rows.length === 0) {
            rows[0] = _upsertRow(layer);
        } else if (rows[newIndex]) {
            rows[newIndex] = _upsertRow(layer, rows[newIndex]);
        } else if (newIndex < 0) {
            rows.unshift(_upsertRow(layer));
        } else {
            rows.push(_upsertRow(layer));
        }

        return rows;
    };

    /**
     * Sort layers in a grid like order, left-to-right, top-to-bottom
     *
     * @param {Immutable.Iterable.<Layer>} layers
     * @return {Immutable.List.<Layer>}
     */
    var gridSort = function (layers) {
        // filter any layers without bounds, just in case
        // sort left-to-right, then reduce them into a grid.
        // note the use of '_.ary()' to pass only the first two reducer args into _addLayerToRow
        var grid = layers.filter(function (layer) {
                return layer.bounds && !layer.bounds.empty;
            })
            .sort(function (a, b) {
                return a.bounds.left - b.bounds.left;
            })
            .reduce(_.ary(_addLayerToRow, 2), []);

        // flatten the array of "rows" into a simple list of layers
        return Immutable.List(_.flatten(_.pluck(grid, "layers")));
    };

    module.exports = gridSort;
});
