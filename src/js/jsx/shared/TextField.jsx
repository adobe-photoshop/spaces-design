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
 
define(function (require, exports, module) {
    "use strict";

    var React = require("react"),
        OS = require("adapter/os");

    // some business about numeric vs free text field and whether that
    // enables up and down arrows or not.
    var _typeToClass = {
        simple: "c-4-25",
        percent: "c-3-25",
        degree: "c-3-25",
        color: "c-6-25",
        shadow: "c-9-25",
        radii: "c-3-25",
        size: "c-2-25",
        combo: "c-16-25 button-combo",
        smallCombo: "c-12-25 button-combo",
        mediumCombo: "c-14-25 button-combo"
    };

    var TextField = React.createClass({
        mixins: [React.addons.PureRenderMixin],

        // bare minimum, ref to refer to it from getInputValue,
        // TextFieldInput classname to style it easily,
        // onMouseDown to get the keyboard focus
        render: function () {
           return  this.transferPropsTo(
                <input
                    type="text"
                    className={_typeToClass[this.props.valueType]}
                    onMouseDown={this.handleMouseDown}
                    onMouseUp={this.handleMouseUp}
                    onFocus={this.handleFocus}/>
            );
        },

        // Use this function outside to get the value after user types in something
        getInputValue: function () {

            console.error("deprecated. use event.target.value instead");

            return this.getDOMNode().value;
        },

        componentDidMount: function () {
            if (this.props.autofocus) {
                var node = this.getDOMNode();
                OS.acquireKeyboardFocus()
                    .catch(function (err) {
                        console.error("Failed to acquire keyboard focus", err);
                    })
                    .then(function() {
                        node.focus();
                    });
            }
        },

        handleMouseDown: function (event) {
            OS.acquireKeyboardFocus().catch(function (err) {
                console.error("Failed to acquire keyboard focus", err);
            });

            if (this.props.onMouseDown) {
                try {
                    this.props.onMouseDown(event);
                } catch (ex) {
                    console.error(ex);
                }
            }
        },

        handleFocus: function (event) {
            this.getDOMNode().select();
            this.receivedFocus = true;

            if (this.props.onFocus) {
                try {
                    this.props.onFocus(event);
                } catch (ex) {
                    console.error(ex);
                }
            }
        },
        
        handleMouseUp: function (event) {
            if (this.receivedFocus) {
                // necessary to prevent Chrome from resetting the selection
                event.preventDefault();
            }
            this.receivedFocus = false;

            if (this.props.onMouseUp) {
                try {
                    this.props.onMouseUp(event);
                } catch (ex) {
                    console.error(ex);
                }
            }
        }
    });

    module.exports = TextField;
});
