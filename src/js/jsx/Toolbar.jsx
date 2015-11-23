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

    var os = require("adapter").os;

    var ToolbarIcon = require("js/jsx/ToolbarIcon"),
        Zoom = require("js/jsx/Zoom"),
        synchronization = require("js/util/synchronization");

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
            this._updateToolbarWidthDebounced = synchronization.debounce(this._updateToolbarWidth, this, 500);
            os.addListener("displayConfigurationChanged", this._updateToolbarWidthDebounced);
            this._updateToolbarWidth();
        },

        componentWillUnmount: function () {
            os.removeListener("displayConfigurationChanged", this._updateToolbarWidthDebounced);
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
        },

        componentDidUpdate: function (prevProps, prevState) {
            if (prevState.pinned !== this.state.pinned) {
                this._updateToolbarWidth();
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
                "toolbar": true
            });
        
            return (
                <div className={toolbarClassName}>
                    <ul>
                        {tools}
                    </ul>
                    <Zoom />
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
                    var node = React.findDOMNode(this),
                        selectedNode = node.querySelector(".tool-selected");

                    if (selectedNode) {
                        selectedNode.classList.remove("tool-selected");
                    }

                    node.querySelector("#" + tool.id).classList.add("tool-selected");
                }

                if (!this.state.pinned) {
                    this._collapseToolbar();
                }
            } else {
                this._expandToolbar();
            }
        },

        /**
         * Returns the current width of the toolbar. Returns 0 if the toolbar
         * is unpinned.
         *
         * @return {number}
         */
        getToolbarWidth: function () {
            var flux = this.getFlux(),
                preferences = flux.store("preferences").getState(),
                pinned = preferences.get("toolbarPinned", true);

            if (!pinned) {
                return 0;
            }

            var toolbarNode = React.findDOMNode(this);
            return toolbarNode ? toolbarNode.getBoundingClientRect().width : 0;
        },

        /**
         * Updates the toolbar panel width.
         *
         * @private
         * @return {Promise}
         */
        _updateToolbarWidth: function () {
            var flux = this.getFlux(),
                newWidth = this.getToolbarWidth();

            return flux.actions.ui.updateToolbarWidth(newWidth);
        },

        /**
         * Debounced version of _updateToolbarWidth
         *
         * @private
         */
        _updateToolbarWidthDebounced: null
    });
    
    module.exports = Toolbar;
});
