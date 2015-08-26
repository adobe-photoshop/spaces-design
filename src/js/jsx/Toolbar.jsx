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
        StoreWatchMixin = Fluxxor.StoreWatchMixin,
        classnames = require("classnames");

    var ToolbarIcon = require("jsx!js/jsx/ToolbarIcon");

    var Toolbar = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("tool", "application", "preferences")],

        /**
         * Ordered list of toolIDs that make up the toolbar layout
         * 
         * @private
         * @type {Array.<string>}
         */
        _layout: [
            "newSelect",
            "rectangle",
            "ellipse",
            "pen",
            "typeCreateOrEdit",
            "sampler"
        ],

        getInitialState: function () {
            return {
                expanded: false
            };
        },
        
        getStateFromFlux: function () {
            // Maybe later on contextStore will send us list of context specific tools
            var flux = this.getFlux(),
                toolState = flux.store("tool").getState(),
                applicationStore = flux.store("application"),
                applicationState = applicationStore.getState(),
                document = applicationStore.getCurrentDocument(),
                preferences = flux.store("preferences").getState(),
                pinned = preferences.get("toolbarPinned", true);

            return {
                currentTool: toolState.current,
                previousTool: toolState.previous,
                document: document,
                pinned: pinned,
                activeDocumentInitialized: applicationState.activeDocumentInitialized,
                recentFilesInitialized: applicationState.recentFilesInitialized
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            // Don't re-render if we're just going temporarily inactive so that
            // the UI doesn't blink unnecessarily.
            if (this.props.active && !nextProps.active) {
                return false;
            }

            // Don't re-render until either the active document or recent files
            // are initialized.
            if (!nextState.activeDocumentInitialized || !nextState.recentFilesInitialized) {
                return false;
            }

            return true;
        },

        // On startup, we want to make sure center offsets take pinned toolbar
        componentDidMount: function () {
            var flux = this.getFlux(),
                preferences = flux.store("preferences").getState(),
                pinned = preferences.get("toolbarPinned", true);

            if (pinned) {
                // NOTE: The toolbar width is offset by one below to account for
                // the gap between the toolbar and the panel. This isn't perfect
                // because the gap might not necessarily be exactly one pixel.
                // This calculation should be improved in the next UI refactor.
                var toolbarWidth = React.findDOMNode(this).clientWidth,
                    newWidth = pinned ? toolbarWidth : 0;

                flux.actions.ui.updateToolbarWidth(newWidth);
            }
        },

        componentWillUpdate: function (nextProps, nextState) {
            var flux = this.getFlux(),
                nextDocument = nextState.document,
                nextDocumentUnsupported = nextDocument && nextDocument.unsupported;

            if (nextDocument && nextDocumentUnsupported) {
                var toolStore = flux.store("tool"),
                    defaultTool = toolStore.getDefaultTool(),
                    currentTool = toolStore.getCurrentTool();

                if (defaultTool !== currentTool) {
                    flux.actions.tools.select(defaultTool);
                }
            }

            if (this.state.pinned !== nextState.pinned) {
                // NOTE: See comment above about the width offset below.
                var toolbarWidth = React.findDOMNode(this).clientWidth,
                    newWidth = nextState.pinned ? toolbarWidth : 0;

                flux.actions.ui.updateToolbarWidth(newWidth);
            }
        },

        render: function () {
            var document = this.state.document,
                disabled = document && document.unsupported;
                
            var toolStore = this.getFlux().store("tool"),
                selectedTool = toolStore.getCurrentTool(),
                selectedToolID = selectedTool ? selectedTool.id : "",
                tools = this._layout.map(function (toolID) {
                    var tool = toolStore.getToolByID(toolID),
                        selected = toolID === selectedToolID;

                    if (toolID === "newSelect" && selectedToolID === "superselectVector") {
                        // Hot swap newSelect for superselectVector and temporarily activate it
                        selected = true;
                        toolID = "superselectVector";
                        tool = toolStore.getToolByID(toolID);
                    } else if (toolID === "typeCreateOrEdit" && selectedToolID === "superselectType") {
                        // Temporarily activate the type tool
                        selected = true;
                    }

                    return (
                        <ToolbarIcon
                            key={toolID}
                            id={toolID}
                            selected={selected}
                            disabled={disabled}
                            onClick={this._handleToolbarButtonClick.bind(this, tool)}
                            toolID={toolID} />
                    );
                }, this);
        
            var toolbarClassName = classnames({
                "expanded": this.state.pinned || this.state.expanded,
                "toolbar": true,
                "toolbar__hidden": !document && !this.state.pinned
            });
        
            return (
                <div className={toolbarClassName}>
                    <ul>
                        {tools}
                    </ul>
                </div>
            );
        },

        /**
         * Expand the toolbar
         * 
         * @private
         */
        _expandToolbar: function () {
            this.setState({ expanded: true });
        },

        /**
         * Collapse the toolbar
         *
         * @private
         */
        _collapseToolbar: function () {
            this.setState({ expanded: false });
        },

        /**
         * Handle toolbar button clicks by selecting the given tool and
         * collapsing the toolbar.
         * 
         * @private
         */
        _handleToolbarButtonClick: function (tool) {
            if (this.state.expanded || this.state.pinned) {
                if (tool) {
                    this.getFlux().actions.tools.select(tool);
                    
                    // HACK: These lines are to eliminate the blink that occurs when the toolbar changes state
                    var node = React.findDOMNode(this);
                    node.querySelector(".tool-selected").classList.remove("tool-selected");
                    node.querySelector("#" + tool.id).classList.add("tool-selected");
                }

                if (!this.state.pinned) {
                    this._collapseToolbar();
                }
            } else {
                this._expandToolbar();
            }
        }
    });
    
    module.exports = Toolbar;
});
