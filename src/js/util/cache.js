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

    var log = require("js/util/log");

    var _derivedProperties = new Map();

    var defineDerivedProperty = function (proto, prop, get, validate) {
        var cache = new WeakMap(),
            stats = {
                cacheMiss: 0,
                cacheMissInvalidate: 0,
                cacheHit: 0,
                cacheHitMigrate: 0,
                lookupMiss: 0,
                lookupHit: 0,
                time: 0
            };

        _derivedProperties.set(prop, {
            get: get,
            validate: validate,
            cache: cache,
            stats: stats
        });

        if (validate === undefined) {
            validate = function (obj) {
                return this.equals(obj);
            };
        }

        Object.defineProperty(proto, prop, {
            get: function () {
                var cacheRec = cache.get(this);
                if (cacheRec) {
                    if (cacheRec.hasOwnProperty("previous")) {
                        var previous = cacheRec.previous;
                        delete cacheRec.previous;

                        if (validate.call(this, previous)) {
                            stats.cacheHitMigrate++;
                            cacheRec.value = cache.get(previous).value;
                            return cacheRec.value;
                        } else {
                            stats.cacheMissInvalidate++;
                        }
                    } else if (cacheRec.hasOwnProperty("value")) {
                        stats.cacheHit++;
                        return cacheRec.value;
                    } else {
                        throw new Error("Cache records must have either a value or previous reference");
                    }
                } else {
                    stats.cacheMiss++;
                    cacheRec = {};
                    cache.set(this, cacheRec);
                }

                var start = Date.now();
                cacheRec.value = get.call(this);
                stats.time += (Date.now() - start);

                return cacheRec.value;
            }
        });
    };

    var defineDerivedProperties = function (proto, spec) {
        Object.keys(spec).forEach(function (prop) {
            if (typeof spec[prop] === "function") {
                defineDerivedProperty(proto, prop, spec[prop]);
            } else {
                defineDerivedProperty(proto, prop, spec[prop].get, spec[prop].validate);
            }
        });
    };
    var defineDerivedLookup = function (proto, prop, lookup, validate) {
        var cache = new WeakMap(),
            stats = {
                cacheMiss: 0,
                cacheMissInvalidate: 0,
                cacheHit: 0,
                cacheHitMigrate: 0,
                lookupMiss: 0,
                lookupHit: 0,
                time: 0
            };

        _derivedProperties.set(prop, {
            lookup: lookup,
            validate: validate,
            cache: cache,
            stats: stats
        });

        if (validate === undefined) {
            validate = function (obj) {
                return this.equals(obj);
            };
        }

        Object.defineProperty(proto, prop, {
            value: function (key) {
                var cacheRec = cache.get(this),
                    table;

                if (cacheRec) {
                    // The structure has a cache reference.
                    if (cacheRec.hasOwnProperty("previous")) {
                        // But it needs to be validated against the previous structure
                        var previous = cacheRec.previous;
                        delete cacheRec.previous;

                        if (validate.call(this, previous)) {
                            // Update this structure's cache reference to use this value,
                            // and indicate that it has been validated by removing the previous reference.
                            stats.cacheHitMigrate++;
                            table = cache.get(previous).value;
                        } else {
                            // Invalidate the cache reference
                            stats.cacheMissInvalidate++;
                            table = new Map();
                        }

                        cacheRec.value = table;
                    } else if (cacheRec.hasOwnProperty("value")) {
                        // The cached value has already been validated, so return it
                        stats.cacheHit++;
                        table = cacheRec.value;
                    } else {
                        throw new Error("Cache records must have either a value or previous reference");
                    }
                } else {
                    stats.cacheMiss++;
                    table = new Map();
                    cacheRec = { value: table };
                    cache.set(this, cacheRec);
                }

                // Use IDs as keys so that values can persist after migration
                if (typeof key === "object") {
                    if (key.key === undefined) {
                        throw new Error("Lookup values must have a unique key property");
                    }
                    key = key.key;
                }

                // Perform the lookup with the cached table first
                var value = table.get(key);
                if (value === undefined) {
                    var start = Date.now();
                    value = lookup.apply(this, arguments);
                    stats.time += (Date.now() - start);
                    stats.lookupMiss++;
                    if (value !== undefined) {
                        table.set(key, value);
                    } else {
                        table.set(key, null);
                    }
                } else {
                    stats.lookupHit++;
                }

                return value;
            }
        });
    };

    var migrate = function (previous, next) {
        _derivedProperties.forEach(function (propObj) {
            var cache = propObj.cache;

            // The cache has already been migrated to the next structure.
            if (cache.get(next)) {
                return;
            }

            // There is no cached information to migrate from the previous structure.
            var cacheRec = cache.get(previous);
            if (cacheRec === undefined) {
                return;
            }

            // Note that whenever a cache record has a previous reference, it
            // necessarily also has a value reference. (The previous reference
            // can be interpreted to mean that the associated value has not yet
            // been validated against the current structure, and should be
            // validated w.r.t. the given previous structure.)
            if (cacheRec.hasOwnProperty("previous")) {
                // It is important to create a new cache reference below.
                // Otherwise, the later validation of a derived structure could
                // implicitly (and unsoundly) validate this structure.
                cache.set(next, {
                    value: cacheRec.value,
                    previous: cacheRec.previous
                });
            } else if (cacheRec.hasOwnProperty("value")) {
                cache.set(next, {
                    value: cacheRec.value,
                    previous: previous
                });
            } else {
                throw new Error("Cache records must have either a value or previous reference");
            }
        });

        return next;
    };

    var printStats = function () {
        var allStats = [];

        _derivedProperties.forEach(function (propObj, prop) {
            var stats = propObj.stats,
                time = stats.time,
                cacheMiss = stats.cacheMiss,
                cacheMissInvalidate = stats.cacheMissInvalidate,
                cacheMissTotal = cacheMiss + cacheMissInvalidate,
                cacheHit = stats.cacheHit,
                cacheHitMigrate = stats.cacheHitMigrate,
                cacheHitTotal = cacheHit + cacheHitMigrate,
                lookupMiss = stats.lookupMiss,
                lookupHit = stats.lookupHit;

            allStats.push({
                prop: prop,
                time: time,
                hitRate: cacheHitTotal / (cacheHitTotal + cacheMissTotal),
                cacheMiss: cacheMiss,
                cacheMissInvalidate: cacheMissInvalidate,
                cacheMissTotal: cacheMissTotal,
                cacheHit: cacheHit,
                cacheHitMigrate: cacheHitMigrate,
                cacheHitTotal: cacheHitTotal,
                lookupMiss: lookupMiss,
                lookupHit: lookupHit
            });
        });

        log.table(allStats);
    };

    exports.defineDerivedProperty = defineDerivedProperty;
    exports.defineDerivedProperties = defineDerivedProperties;
    exports.defineDerivedLookup = defineDerivedLookup;
    exports.migrate = migrate;
    exports.printStats = printStats;
});
