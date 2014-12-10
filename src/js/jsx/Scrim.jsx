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
        FluxMixin = Fluxxor.FluxMixin(React),
        StoreWatchMixin = Fluxxor.StoreWatchMixin;

    var os = require("adapter/os"),
        keyutil = require("js/util/key");

    var Scrim = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("tool", "ui")],

        /**
         * Dispatches (synthetic) click events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleClick: function (event) {
            var tool = this.state.current;

            if (tool && tool.onClick) {
                tool.onClick.call(this, event);
            }
        },

        /**
         * Dispatches (synthetic) doubleclick events from the scrim to the currently
         * active tool.
         *
         * @private
         * @param  {SyntheticEvent} event
         */
        _handleDoubleClick: function (event) {
            var tool = this.state.current,
                flux = this.getFlux();

            // If there are no documents open, send a "Open" command to Photoshop
            if (!flux.store("application").getCurrentDocument()) {
                flux.actions.menu.native({commandID: 20});
                return;
            }

            if (tool && tool.onDoubleClick) {
                tool.onDoubleClick.call(this, event);
            }

            
        },

        /**
         * Dispatches (synthetic) mousedown events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleMouseDown: function (event) {
            var tool = this.state.current;

            if (document.activeElement !== document.body) {
                document.activeElement.blur();
            }

            if (tool && tool.onMouseDown) {
                tool.onMouseDown.call(this, event);
            }
        },

        /**
         * Dispatches (synthetic) mouseup events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleMouseUp: function (event) {
            var tool = this.state.current;

            if (tool && tool.onMouseUp) {
                tool.onMouseUp.call(this, event);
            }
        },

        /**
         * Dispatches (synthetic) mouseMove events from the scrim to the currently
         * active tool.
         * 
         * @private
         * @param {SynthenticEvent} event
         */
        _handleMouseMove: function (event) {
            var tool = this.state.current;

            if (tool && tool.onMouseMove) {
                tool.onMouseMove.call(this, event);
            }
        },

        /**
         * Construct a semantic event from an adapter event.
         * 
         * @private
         * @param {{eventKind: number, keyCode: number=, keyChar: string=, modifiers: number}} event
         * @return {{keyCode: number=, keyChar: string=, modifiers: object}}
         */
        _makeSemanticEvent: function (event) {
            var semanticEvent = {
                modifiers: keyutil.bitsToModifiers(event.modifiers)
            };

            if (event.keyChar) {
                semanticEvent.keyChar = event.keyChar;
            } else if (event.hasOwnProperty("keyCode")) {
                semanticEvent.keyCode = event.keyCode;
            } else {
                throw new Error("Adapter key event has no key specification");
            }

            return semanticEvent;
        },

        /**
         * Dispatches semantic keyup events from the window to the currently
         * active tool.
         * 
         * @private
         * @param {{eventKind: number, keyCode: number=, keyChar: string=, modifiers: number}} event
         */
        _handleKeyUp: function (event) {
            var tool = this.state.current,
                semanticEvent;

            if (tool && tool.onKeyUp) {
                semanticEvent = this._makeSemanticEvent(event);
                tool.onKeyUp.call(this, semanticEvent);
            }
        },

        /**
         * Dispatches semantic keydown events from the window to the currently
         * active tool.
         * 
         * @private
         * @param {{eventKind: number, keyCode: number=, keyChar: string=, modifiers: number}} event
         */
        _handleKeyDown: function (event) {
            var tool = this.state.current,
                semanticEvent;

            if (tool && tool.onKeyDown) {
                semanticEvent = this._makeSemanticEvent(event);
                tool.onKeyDown.call(this, semanticEvent);
            }
        },

        /**
         * Routes native adapter key events to the handler appropriate for
         * their type.
         *
         * @private
         * @param {{eventKind: number, keyCode: number=, keyChar: string=, modifiers: number}} event
         */
        _handleExternalKeyEvent: function (event) {
            // Don't dispatch the key event if a focusable DOM element is active
            if (document.activeElement !== document.body) {
                return;
            }

            switch (event.eventKind) {
            case os.eventKind.KEY_DOWN:
                this._handleKeyDown(event);
                break;
            case os.eventKind.KEY_UP:
                this._handleKeyUp(event);
                break;
            }
        },

        getStateFromFlux: function () {
            var flux = this.getFlux(),
                toolStore = flux.store("tool");

            return toolStore.getState();
        },

        /**
         * Adds adapter key-event listeners.
         */
        componentWillMount: function () {
            // Key events are received from the adapter instead of the window or scrim
            os.on(os.notifierKind.EXTERNAL_KEYEVENT, this._handleExternalKeyEvent);
        },

        /**
         * Removes adapter key-event listeners.
         */
        componentWillUnmount: function() {
            os.off(os.notifierKind.EXTERNAL_KEYEVENT, this._handleExternalKeyEvent);
        },

        /**
         * Renders the current tool overlay if there is one
         * @private
         */
        _renderToolOverlay: function () {
            var tool = this.state.current;

            if (tool && tool.toolOverlay) {
                var ToolOverlay = tool.toolOverlay;

                return (
                    <ToolOverlay />
                );
            } 

            return null;            
        },

        render: function () {
            var toolOverlay = this._renderToolOverlay();

            // Only the mouse event handlers are attached to the scrim
            return (
                <div 
                    ref="scrim"
                    className="scrim"
                    onDoubleClick={this._handleDoubleClick}
                    onMouseDown={this._handleMouseDown}
                    onMouseMove={this._handleMouseMove}
                    onMouseUp={this._handleMouseUp}>
                    {toolOverlay}
                </div>
            );
        }
    });

    module.exports = Scrim;
});
