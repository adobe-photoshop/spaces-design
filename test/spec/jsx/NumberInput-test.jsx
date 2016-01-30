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

/* global module, test, equal, expect */

define(function (require) {
    "use strict";

    var ReactDOM = require("react-dom"),
        TestUtils = require("react-addons-test-utils");

    var NumberInput = require("js/jsx/shared/NumberInput");

    module("jsx/NumberInput");

    test("Tests the test runner", function () {
        expect(2);

        var initialValue = 123,
            updatedValue = 1234,
            expectedValue = updatedValue;

        var numberInput;
        // Asserts that the value in the change event is equal to the updated value.
        // Note that this should only be called when the rawValue changes to reflect
        // a true value.
        var assertValueChange = function (event, value) {
            equal(value, expectedValue, "Event value is correct");
            numberInput.props.value = value;
        };

        // Render and mount an instance of <NumberInput/> into the DOM
        numberInput = TestUtils.renderIntoDocument(
            <NumberInput value={initialValue} onChange={assertValueChange}/>
        );

        // Events are simulated on the underlying DOM node
        var numberInputDOMNode = ReactDOM.findDOMNode(numberInput);

        // Simulate a change event by giving the DOM node a new raw value that
        // corresponds to a true value
        TestUtils.Simulate.change(numberInputDOMNode, {
            target: {
                value: updatedValue.toString()
            }
        });
        TestUtils.Simulate.keyDown(numberInputDOMNode, { key: "Enter" });

        // Simulate a change event by giving the DOM node a new raw value that
        // does NOT correspond to a true value and attempting to commit the change.
        TestUtils.Simulate.change(numberInputDOMNode, {
            target: {
                value: updatedValue.toString() + "abc"
            }
        });
        TestUtils.Simulate.keyDown(numberInputDOMNode, { key: "Enter" });

        // Simulate a change event by giving the DOM node a new raw value that
        // does NOT correspond to a true value, but then reset the change.
        TestUtils.Simulate.change(numberInputDOMNode, {
            target: {
                value: updatedValue.toString() + "abc"
            }
        });
        TestUtils.Simulate.keyDown(numberInputDOMNode, { key: "Escape" });

        expectedValue += 1;
        TestUtils.Simulate.keyDown(numberInputDOMNode, { key: "ArrowUp" });
    });
});
