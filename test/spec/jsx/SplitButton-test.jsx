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

/**
 * Very minimal test of the React Component SplitButton
 */

define(function (require) {
    "use strict";

    var React = require("react"),
        TestUtils = React.addons.TestUtils,
        _ = require("lodash");

    var SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonItem = SplitButton.SplitButtonItem,
        SplitButtonList = SplitButton.SplitButtonList;

    module("jsx/SplitButton");

    test("Tests the test runner", function () {
        expect(4);
                
        // validate that only the enabled button should pass back to this onClick handler
        var _handleClick = function (event) {
            ok(/split-button__item.*/.test(event.target.id), 
               "The button triggering this onClick handler should have a reasonable ID");
            notEqual(event.target.id, "split-button__item__2", 
                     "The button triggering this onClick handler (" +
                     event.target.id +
                     ") should NOT be 'split-button__item__2' because that should be disabled");
        };

        // Render and mount an instance of <SplitButtonList/> into the DOM
        // There are two buttons, the second is disabled
        var splitButtonListComponent = TestUtils.renderIntoDocument(
            <SplitButtonList>
                <SplitButtonItem 
                                id="split-button__item__1"
                                selected={false}
                                disabled={false}
                                onClick={_handleClick} />
                <SplitButtonItem 
                                id="split-button__item__2"
                                selected={false}
                                disabled={true}
                                onClick={_handleClick} />
            </SplitButtonList>
        );

        // Grab the necessary DOM nodes
        var domNode = splitButtonListComponent.getDOMNode(),
            items = domNode.childNodes;
        
        // validate that some styles were created correctly based on list size, and disabled-ness
        ok(_.contains(domNode.classList, "c-12-25"), "The list should have the class c-12-25 assigned");
        ok(_.contains(domNode.childNodes[1].classList, "split-button__item__disabled"), 
           "The second button should have the class split-button__item__disabled because it is disabled");
        
        // Click both of the buttons.  The second one is disabled and should not trigger the callback
        TestUtils.Simulate.click(items[0]);
        TestUtils.Simulate.click(items[1]);
            
    });
});
