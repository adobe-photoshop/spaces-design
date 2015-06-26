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

    var TitleHeader = require("jsx!js/jsx/shared/TitleHeader"),
        LibraryList = require("jsx!./LibraryList"),
        LibraryBar = require("jsx!./LibraryBar"),
        Library = require("jsx!./Library"),
        Button = require("jsx!js/jsx/shared/Button"),
        SVGIcon = require("jsx!js/jsx/shared/SVGIcon"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        strings = require("i18n!nls/strings");

    var LibrariesPanel = React.createClass({
        mixins: [FluxMixin, StoreWatchMixin("library")],

        getInitialState: function () {
            return ({
                selectedLibrary: null
            });
        },

        getStateFromFlux: function () {
            var libraryStore = this.getFlux().store("library"),
                libraries = libraryStore.getLibraries();

            return {
                libraries: libraries
            };
        },

        /**
         * A throttled version of os.setTooltip
         *
         * @type {?function}
         */
        _setTooltipThrottled: null,

        shouldComponentUpdate: function (nextProps) {
            if (this.props.disabled !== nextProps.disabled) {
                return true;
            }

            if (!nextProps.visible && !this.props.visible) {
                return false;
            }

            return true;
        },

        _handleRefresh: function () {
            this.getFlux().actions.libraries.beforeStartup();
            this.getFlux().actions.libraries.afterStartup();
        },

        _handleAddElement: function (element) {
            this.getFlux().actions.libraries.createLayerFromElement(element);
        },

        _handleLibraryChange: function (libraryID) {
            this.setState({
                selectedLibrary: libraryID
            });

            this.getFlux().actions.libraries.prepareLibrary(libraryID);
        },

        _handleLibraryAdd: function () {
            this.getFlux().actions.libraries.createLibrary("New Library");
        },

        _handleLibraryRemove: function () {
            this.getFlux().actions.libraries.removeCurrentLibrary();
        },

        render: function () {
            var libraryStore = this.getFlux().store("library"),
                connected = libraryStore.getConnectionStatus(),
                libraries = this.state.libraries,
                currentLibrary = libraries[this.state.selectedLibrary],
                currentLibraryItems = libraryStore.getLibraryItems(this.state.selectedLibrary);

            var containerClasses = classnames({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = classnames({
                "libraries": true,
                "section": true,
                "section__sibling-collapsed": !this.props.visibleSibling
            });

            var containerContents;

            if (connected) {
                containerContents = this.props.visible && !this.props.disabled && (
                <div>
                    <div className="formline">
                        <LibraryList
                            ref="libraryList"
                            libraries={libraries}
                            selected={currentLibrary}
                            onLibraryChange={this._handleLibraryChange}
                        />
                        <SplitButtonList>
                            <SplitButtonItem
                                title={strings.TOOLTIPS.GRID_MODE}
                                className="button-plus"
                                iconId="plus"
                                onClick={this._handleLibraryAdd}
                                />
                            <SplitButtonItem
                                title={strings.TOOLTIPS.LIST_MODE}
                                className="button-plus"
                                iconId="distribute-vertically"
                                onClick={this._handleLibraryRemove}
                                />
                        </SplitButtonList>
                    </div>
                    <Library
                        addElement={this._handleAddElement}
                        items={currentLibraryItems}
                    />
                    <LibraryBar />
                </div>);
            } else {
                containerContents = (
                    <div>
                        Can't connect to local library process!
                         <Button
                            title="Refresh"
                            className="button-plus"
                            onClick={this._handleRefresh}>
                            <SVGIcon
                                viewbox="0 0 12 12"
                                CSSID="plus" />
                        </Button>
                    </div>
                );
            }

            return (
                <section
                    className={sectionClasses}>
                    <TitleHeader
                        title={strings.TITLE_LIBRARIES}
                        visible={this.props.visible}
                        disabled={this.props.disabled}
                        onDoubleClick={this.props.onVisibilityToggle} />
                    <div className={containerClasses}>
                        {containerContents}
                    </div>
                </section>
            );
        }
    });

    module.exports = LibrariesPanel;
});
