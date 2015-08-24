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

    var Immutable = require("immutable");

    /**
     * Extracts a "uniform" value from a list of values, where uniformity is
     * tested using the given equality predicate. If the equality predicate is
     * undefined, reference equality is used. If the list is determined to have
     * a uniform value, the first such value is returned. If not, null is
     * returned.
     * 
     * @param {Immutable.Iterable.<*>} values
     * @param {function(*,*):boolean=} equals Optional equality predicate.
     * @param {*} notSetValue The value to return if there is no uniform value.
     *  Defaults to null.
     * @return {*} The first value if the the values are uniform, or null.
     */
    var uniformValue = function (values, equals, notSetValue) {
        if (typeof equals !== "function") {
            notSetValue = equals;
            equals = Immutable.is;
        }

        if (notSetValue === undefined) {
            notSetValue = null;
        }

        if (!values || values.isEmpty()) {
            return notSetValue;
        }

        var first = values.get(0);
        if (values.size === 1) {
            return first;
        }

        var nonuniform = values.rest()
            .some(function (b) {
                return !equals(first, b);
            });

        if (nonuniform) {
            return notSetValue;
        }

        return first;
    };

    /**
     * Pluck the given property from each element of the iterable.
     * 
     * @param {Immutable.Iterable} iterable
     * @param {string} property
     * @param {*} notSetValue
     * @return {Immutable.Iterable}
     */
    var pluck = function (iterable, property, notSetValue) {
        return iterable.map(function (obj) {
            if (obj) {
                if (obj.hasOwnProperty(property) || obj[property]) {
                    return obj[property];
                } else if (obj instanceof Immutable.Iterable) {
                    return obj.get(property, notSetValue);
                }
            }

            return notSetValue;
        });
    };

    /**
     * Pluck the given properties from each element of the iterable.
     *
     * @param {Immutable.Iterable} iterable
     * @param {Immutable.Iterable.<string>|Array.<string>} properties
     * @return {Immutable.Iterable}
     */
    var pluckAll = function (iterable, properties) {
        return iterable.map(function (obj) {
            return Immutable.Map(properties.reduce(function (map, property) {
                if (obj) {
                    if (obj.hasOwnProperty(property) || obj[property]) {
                        return map.set(property, obj[property]);
                    } else if (obj instanceof Immutable.Iterable && obj.has(property)) {
                        return map.set(property, obj.get(property));
                    }
                }
                return map;
            }, new Map()));
        });
    };

    /**
     * Transpose the iterable of iterables.
     * 
     * @param {Immutable.Iterable<Immutable.Iterable>} iterable
     * @param {*} notSetValue
     * @return {Immutable.Iterable<Immutable.Iterable>}
     */
    var zip = function (iterable, notSetValue) {
        if (iterable.isEmpty()) {
            return Immutable.List();
        }

        var max = pluck(iterable, "size", 0).max();

        return Immutable.Range(0, max).map(function (index) {
            return iterable.map(function (subiterable) {
                return subiterable.get(index, notSetValue);
            });
        });
    };

    /**
     * Calculate the intersection of the iterable and collection.
     * 
     * @param {Immutable.Iterable} iterable
     * @param {Immutable.Collection} collection
     * @return {Immutable.Iterable}
     */
    var intersection = function (iterable, collection) {
        return iterable.filter(function (elem) {
            return collection.contains(elem);
        });
    };

    /**
     * Calculate the difference of the iterable and collection.
     * 
     * @param {Immutable.Iterable} iterable
     * @param {Immutable.Collection} collection
     * @return {Immutable.Iterable}
     */
    var difference = function (iterable, collection) {
        return iterable.filter(function (elem) {
            return !collection.contains(elem);
        });
    };

    exports.uniformValue = uniformValue;
    exports.zip = zip;
    exports.pluck = pluck;
    exports.pluckAll = pluckAll;
    exports.intersection = intersection;
    exports.difference = difference;
});
