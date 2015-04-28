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

    var _ = require("lodash");

    var TEST_SECTION_MAP = {
        unit: [
            "test/spec/identity-test",
            "test/spec/actions/application-test",
            "test/spec/actions/document-test",
            "test/spec/actions/example-test",
            "test/spec/stores/document-test",
            "test/spec/stores/stroke-test",
            "test/spec/stores/example-test",
            "jsx!test/spec/jsx/NumberInput-test",
            "jsx!test/spec/jsx/SplitButton-test"
        ],
        integration: [
        ]
    };

    var getSpecsByClass = function (specClass) {
        var section = specClass || "unit",
            tests = [];

        if (section !== "all" && !TEST_SECTION_MAP.hasOwnProperty(section)) {
            section = "unit";
        }

        if (section === "all") {
            tests = Array.prototype.concat.apply([], _.values(TEST_SECTION_MAP));
        } else if (TEST_SECTION_MAP.hasOwnProperty(section)) {
            tests = TEST_SECTION_MAP[section];
        }

        return tests;
    };

    exports.getSpecsByClass = getSpecsByClass;
});
