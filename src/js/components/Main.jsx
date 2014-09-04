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
        Fluxxor = require("fluxxor");

    var NumberInput = require("jsx!./shared/NumberInput"),
        NumberArrayInput = require("jsx!./shared/NumberArrayInput");

    var FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var Main = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("dummy")],
        getStateFromFlux: function () {
            var flux = this.getFlux(),
                dummy = flux.store("dummy");

            return dummy.getState();
        },
        render: function () {
            var time = this.state.time === null ? "n/a" : this.state.time;

            return (
                <div>
                    <NumberInput
                        ref="left"
                        onValueChange={this.handleNumberChange.bind(this, "left")}
                        defaultValue={123}/>
                    <NumberInput
                        ref="right"
                        onValueChange={this.handleNumberChange.bind(this, "right")}
                        defaultValue={456}/>
                    <NumberArrayInput
                        ref="array"
                        onValueChange={this.handleNumberArrayChange}
                        defaultValue={[123, 456]}/>
                    <input
                        value={time}
                        onChange={this.handleTimeChange}
                    />
                </div>
            );
        },
        handleNumberChange: function (ref, value) {
            var otherRef = ref === "left" ? "right" : "left",
                otherValue = this.refs[otherRef].getValue(),
                arrayValue = ref === "left" ? [value, otherValue] : [otherValue, value];

            this.refs.array.setValue(arrayValue);
            this.getFlux().actions.dummy.doAction();
        },
        handleNumberArrayChange: function (value) {
            this.refs.left.setValue(value[0]);
            this.refs.right.setValue(value[1]);
            this.getFlux().actions.dummy.doAction();
        },
        handleTimeChange: function (event) {
            this.setState({
                time: event.target.value
            });
        }
    });

    module.exports = Main;
});
