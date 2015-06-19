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
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React);

    /**
     * Create a composed Droppoable component
     * 
     * The getProps function should return an object of the form:
     *  {
     *     key: (Unique key for this droppable),
     *     keyObject: (Object that is being dropped on),
     *     validate: (Function that accepts an argument of 
     *         object being dropped on this keyObject, returns a boolean),
     *     handleDrop: (Function to handle dropping of object on this droppable)
     *    }
     *
     * @param {ReactComponent} Component Component to wrap
     * @param {function} getProps function to return an object with the props required by Droppable
     * @return {ReactComponent}
     */
    var createWithComponent = function (Component, getProps, isEqual, shouldUpdate) {
        var Droppable = React.createClass({
            mixins: [FluxMixin],
            _register: function () {
                var node = React.findDOMNode(this),
                    options = getProps(this.props),
                    key = options.key,
                    keyObject = options.keyObject,
                    validate = options.validate,
                    handleDrop = options.handleDrop;

                this.getFlux().actions.draganddrop.registerDroppable(node, key, validate, handleDrop, keyObject);
            },

            shouldComponentUpdate: function (nextProps) {
                return shouldUpdate.bind(this, nextProps)();
            },

            /*
            * Returns the registration information (possibly for use in a batch register)
            *
            * Returned object has properties:
            *     key: (Unique key for this droppable),
            *     keyObject: (Object that is being dropped on),
            *     validate: (Function that accepts an argument of 
            *         object being dropped on this keyObject, returns a boolean),
            *     handleDrop: (Function to handle dropping of object on this droppable)
            *
            * @return {Array [k,v]} with information about registration for easy ingestion into OrderedMap
            *
            */
            getRegistration: function () {
                var options = getProps(this.props);

                return [options.key, {
                    node: React.findDOMNode(this),
                    validate: options.validate,
                    onDrop: options.handleDrop,
                    keyObject: options.keyObject
                }];
            },

            componentDidMount: function () {
                if (this.props.registerOnMount) {
                    this._register();
                }
            },

            componentWillUnmount: function () {
                if (this.props.deregisterOnUnmount) {
                    this.getFlux().actions.draganddrop.deregisterDroppable(getProps(this.props).key);
                }
            },

            componentDidUpdate: function (prevProps) {
                if (!isEqual(getProps(this.props).keyObject, getProps(prevProps).keyObject)) {
                    this._register();
                }
            },

            render: function () {
                return <Component {...this.props} {...this.state} />;
            }
        });

        return Droppable;
    };

    module.exports = { createWithComponent: createWithComponent };
});
