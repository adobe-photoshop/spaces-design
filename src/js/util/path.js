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

    var system = require("./system"),
        _ = require("lodash");

    /**
     * System-dependent path separator.
     *
     * @type {string}
     */
    var sep = system.isMac ? "/" : "\\";

    /**
     * Extract the base-name of a path. For example, return "baz" from "/foo/bar/baz".
     *
     * @param {!string} path
     * @return {string}
     */
    var basename = function (path) {
        var index = path.lastIndexOf(sep);
        if (index === -1) {
            return path;
        }

        return path.substring(index + 1);
    };
    
    /**
     * Return the directory name of a path.
     * e.g. /foo/bar/baz -> /foo/bar
     *
     * @param {!string} path
     * @return {string}
     */
    var dirname = function (path) {
        var index = path.lastIndexOf(sep);
        if (index === -1) {
            return path;
        }

        return path.substring(0, index);
    };

    /**
     * Extract the extension of a path. Empty if no extension
     *
     * @param {!string} path
     * @return {string}
     */
    var extension = function (path) {
        var filename = basename(path),
            index = filename.lastIndexOf(".");

        if (index === -1) {
            return "";
        }

        return filename.substring(index + 1);
    };

    /**
     * Given a list of paths, reduces them to shortest unique paths
     * Example:
     * Input:
     * "foo/bar/one"
     * "foo/bar/two"
     * "foo/one"
     * Output:
     * "bar/one"
     * "two"
     * "foo/one"
     *
     * @param {Immutable.Iterable.<string>} paths List of file paths to reduce
     * @return {Immutable.Iterable.<string>} Unique path for each file that's as short as possible
     */
    var getShortestUniquePaths = function (paths) {
        // Helper function, finds paths that match in subpaths to a particular path
        var _getMatchingPaths = function (matchingSoFar, key, keyIndex) {
            return matchingSoFar.filter(function (pathComponents) {
                return pathComponents[keyIndex] === key;
            });
        };

        // Break down all paths and reverse them
        var allPathComponents = paths.map(function (path) {
                return path.split(sep).reverse();
            }),
            shortestPathLengths = allPathComponents.map(function (path) {
                var keyIndex = 0,
                    currentKey,
                    unique = false,
                    matchingPaths = allPathComponents;

                while (!unique && keyIndex < path.length) {
                    currentKey = path[keyIndex];
                    matchingPaths = _getMatchingPaths(matchingPaths, currentKey, keyIndex);

                    if (matchingPaths.size === 1) {
                        unique = true;
                    }
                    
                    keyIndex++;
                }
                return keyIndex;
            });

        // After finding the shortest subpaths, reverse and re-stringify
        return allPathComponents.map(function (parts, index) {
            return _.take(parts, shortestPathLengths.get(index)).reverse().join(sep);
        });
    };

    exports.sep = sep;
    exports.basename = basename;
    exports.extension = extension;
    exports.dirname = dirname;

    exports.getShortestUniquePaths = getShortestUniquePaths;
});
