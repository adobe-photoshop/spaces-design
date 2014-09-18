/** @jsx React.DOM */
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

/* global module, test, equal */

define(function (require) {
    "use strict";

    var React = require("react"),
        TestUtils = React.addons.TestUtils;

    var NumberInput = require("jsx!js/jsx/shared/NumberInput");

    module("jsx/NumberInput");

    test("Tests the test runner", function () {
        expect(6);

        var initialValue = 123,
            updatedValue = 1234;

        // Asserts that the value in the change event is equal to the updated value.
        // Note that this should only be called when the rawValue changes to reflect
        // a true value.
        var assertValueChange = function (value) {
            equal(value, updatedValue, "Event value is correct");
        };

        // Render and mount an instance of <NumberInput/> into the DOM
        var numberInput = TestUtils.renderIntoDocument(
            <NumberInput value={initialValue} onValueChange={assertValueChange}/>
        );
        equal(numberInput.getValue(), initialValue, "Initial value is correct");

        // Events are simulated on the underlying DOM node
        var numberInputDOMNode = numberInput.getDOMNode();

        // Simulate a change event by giving the DOM node a new raw value that
        // corresponds to a true value
        TestUtils.Simulate.change(numberInputDOMNode, {
            target: {
                value: updatedValue.toString()
            }
        });
        equal(numberInput.getValue(), updatedValue, "Updated value is correct");

        // Simulate a change event by giving the DOM node a new raw value that
        // does NOT correspond to a true value. No valueChange event should be
        // fired here, and the result of getValue should not change.
        TestUtils.Simulate.change(numberInputDOMNode, {
            target: {
                value: updatedValue.toString() + "abc"
            }
        });
        equal(numberInput.getValue(), updatedValue, "Value remains correct after bad input");

        // Simulate a change event by giving the DOM node a new raw value that
        // again corresponds to a true value.
        TestUtils.Simulate.change(numberInputDOMNode, {
            target: {
                value: updatedValue.toString()
            }
        });
        equal(numberInput.getValue(), updatedValue, "Value updates after good input");        
    });
});
