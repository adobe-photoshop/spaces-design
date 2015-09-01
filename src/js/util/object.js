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

    /**
     * Search for a deep property in an object guided by a path. For example:
     * 
     * obj = { a: { b: { c: 1 } } }
     * getPath(obj, "a")
     * > { b: { c: 1 } }
     * getPath(obj, "a.b")
     * > { c: 1 }
     * getPath(obj, "a.b.c")
     * > 1
     * getPath(obj, "a.d")
     * > undefined
     *
     * @param {object} obj
     * @param {string} path
     * @return {*} Returns the value found at the path, or undefined.
     */
    var getPath = function (obj, path) {
        if (typeof obj !== "object") {
            return undefined;
        }

        path.split(".").some(function (part) {
            if (obj.hasOwnProperty(part)) {
                obj = obj[part];
            } else {
                obj = undefined;
                return true;
            }
        });

        return obj;
    };

    /**
     * If the given value is truthy, assign it to the given property on the
     * given object. Otherwise, do not mutate the object.
     *
     * @param {object} obj
     * @param {string} prop
     * @param {*} val
     * @return {object}
     */
    var assignIf = function (obj, prop, val) {
        if (val) {
            obj[prop] = val;
        }

        return obj;
    };

    /**
     * Produce an object specification, consumable by Object.defineProperty,
     * for a lazily computed, cached property using the supplied getter function.
     * 
     * @param {string} propName
     * @param {function()} getter
     * @param {object=} propSpec This object is augmented with the new spec if it exists
     * @return {object}
     */
    var cachedGetSpec = function (propName, getter, propSpec) {
        var privatePropName = window.Symbol(propName);

        propSpec = propSpec || {};

        propSpec[propName] = {
            enumerable: true,
            get: function () {
                // FIXME: This should be replaced with a supported mutability
                // test or simply removed. See discussion here:
                // https://github.com/facebook/immutable-js/issues/257
                if (this.wasAltered()) {
                    delete this[privatePropName];
                    return getter.apply(this, arguments);
                } else {
                    if (!this.hasOwnProperty(privatePropName)) {
                        this[privatePropName] = getter.apply(this, arguments);
                    }
                    return this[privatePropName];
                }
            }
        };

        return propSpec;
    };

    /**
     * Produce an object specification, consumable by Object.defineProperties,
     * for lazily computed, cached properties using the supplied getter functions.
     * 
     * @param {Object.<string, function()>} specs Map of property name to getter
     * @return {object}
     */
    var cachedGetSpecs = function (specs) {
        return Object.keys(specs).reduce(function (propSpecs, key) {
            return cachedGetSpec(key, specs[key], propSpecs);
        }, {});
    };

    /**
     * Memoize a lookup function.
     * 
     * @param {function()} lookup Un-memoized lookup function.
     * @return {{ value: function }} Memoized lookup function.
     */
    var cachedLookupSpec = function (lookup) {
        var privateCacheName = window.Symbol();

        return {
            value: function (key) {
                if (!this.hasOwnProperty(privateCacheName)) {
                    this[privateCacheName] = new Map();
                }

                var cache = this[privateCacheName];
                if (cache.has(key)) {
                    return cache.get(key);
                } else {
                    var result = lookup.apply(this, arguments);
                    cache.set(key, result);
                    return result;
                }
            }
        };
    };

    exports.getPath = getPath;
    exports.assignIf = assignIf;
    exports.cachedGetSpec = cachedGetSpec;
    exports.cachedGetSpecs = cachedGetSpecs;
    exports.cachedLookupSpec = cachedLookupSpec;
});
