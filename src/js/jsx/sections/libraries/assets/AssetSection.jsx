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
        _ = require("lodash"),
        classnames = require("classnames");

    var nls = require("js/util/nls");

    var LibraryDialog = require("jsx!js/jsx/sections/libraries/LibraryDialog"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem;

    var AssetSection = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            element: React.PropTypes.object.isRequired,
            onSelect: React.PropTypes.func,
            displayName: React.PropTypes.string.isRequired,
            title: React.PropTypes.string,
            subTitle: React.PropTypes.string
        },
        
        /**
         * True if title is in editing mode.
         * 
         * @type {boolean}
         */
        _isEditingTitle: false,

        getInitialState: function () {
            return {
                deleting: false
            };
        },

        shouldComponentUpdate: function (nextProps, nextState) {
            return !_.isEqual(this.props, nextProps) ||
                   this.state.deleting !== nextState.deleting;
        },

        /**
         * Handle select asset event.
         * 
         * @private
         * @param {SyntheticEvent=} event
         */
        _handleSelect: function (event) {
            if (event) {
                event.stopPropagation();
            }

            if (!this._isEditingTitle && this.props.onSelect) {
                this.props.onSelect(this.props.element);
            }
        },

        /**
         * Rename layer
         *
         * @private
         * @param {SyntheticEvent} event
         * @param {string} newName
         */
        _handleRename: function (event, newName) {
            if (this.props.displayName !== newName) {
                this.getFlux().actions.libraries.renameAsset(this.props.element, newName);
            }
        },

        /**
         * Set the asset in deleting mode. This will show a confirmation dialog for deleting the selected asset.
         *
         * @private
         */
        _handleDelete: function () {
            this.setState({ deleting: true });
        },

        /**
         * Cancel deleting the selected asset.
         *
         * @private
         */
        _handleCancelDeletion: function () {
            this.setState({ deleting: false });
        },

        /**
         * Invoke libraries action to delete the selected asset.
         *
         * @private
         */
        _handleConfirmDeletion: function () {
            this.getFlux().actions.libraries.removeAsset(this.props.element);
            this.setState({ deleting: false });
        },
        
        /**
         * Click on element title will treat as select the asset. Before processing the event, we will wait 
         * to make sure it is not part of a title-double-clicked event, as double clikc on element title will 
         * also trigger a click event. 
         * 
         * @private
         * @param {SyntheticEvent} event
         */
        _handleTitleClicked: function (event) {
            event.stopPropagation();
            
            if (!this._isEditingTitle) {
                window.setTimeout(function () {
                    if (!this._isEditingTitle) {
                        this._handleSelect();
                    }
                }.bind(this), 250);
            }
        },

        /**
         * Handle start editing title.
         * 
         * @private
         */
        _handleStartEditingTitle: function () {
            this._isEditingTitle = true;
        },

        /**
         * Handle end editing title.
         * 
         * @private
         */
        _handleEndEditingTitle: function () {
            this._isEditingTitle = false;
        },
            
        /**
         * Handle element button clicked
         *
         * @private
         * @param {string} event - name of the click event
         * @param {string} url
         */
        _handleElementButtonClicked: function (event, url) {
            this.getFlux().actions.menu.openURL({
                category: "libraries",
                subcategory: "library",
                eventName: event,
                url: url
            });
        },

        render: function () {
            var sectionContent,
                deleteConfirmationDialog,
                element = this.props.element,
                title = this.props.title || this.props.displayName,
                subTitle = this.props.subTitle &&
                    (<div className="libraries__asset__subtitle" title={title}> {this.props.subTitle} </div>);

            if (this.props.selected) {
                var library = element.library,
                    elementLink = ["https://assets.adobe.com/assets/libraries", library.id, element.id].join("/"),
                    shareLink = elementLink + "?dialog=share";
                sectionContent = (
                    <SplitButtonList className="libraries__asset__buttons">
                        <div className="libraries__asset__title">
                            <TextInput
                                ref="input"
                                doubleClickToEdit={true}
                                title={title}
                                value={this.props.displayName}
                                onClick={this._handleTitleClicked}
                                onDoubleClick={this._handleStartEditingTitle}
                                onChange={this._handleRename}
                                onBlur={this._handleEndEditingTitle}/>
                            {subTitle}
                        </div>
                        <SplitButtonItem
                            title={nls.localize("strings.TOOLTIPS.LIBRARY_SEND_LINK")}
                            iconId="libraries-share"
                            onClick={this._handleElementButtonClicked.bind(this, "share-public-link", shareLink)} />
                        <SplitButtonItem
                            title={nls.localize("strings.TOOLTIPS.LIBRARY_VIEW_ON_WEBSITE")}
                            iconId="libraries-viewonsite"
                            onClick={this._handleElementButtonClicked.bind(this, "view-online", elementLink)} />
                         <SplitButtonItem
                            title={nls.localize("strings.TOOLTIPS.LIBRARY_DELETE")}
                            iconId="delete"
                            onClick={this._handleDelete} />
                    </SplitButtonList>
                );
            } else {
                sectionContent = (
                    <div className="libraries__asset__title">
                        <TextInput
                            ref="input"
                            doubleClickToEdit={true}
                            title={title}
                            value={this.props.displayName}
                            onClick={this._handleTitleClicked}
                            onDoubleClick={this._handleStartEditingTitle}
                            onChange={this._handleRename}
                            onBlur={this._handleEndEditingTitle}/>
                        {subTitle}
                    </div>
                );
            }

            if (this.state.deleting) {
                var dialogTitle = nls.localize("strings.LIBRARIES.DELETE_ASSET").replace("%s", element.name),
                    body = nls.localize("strings.LIBRARIES.DELETE_ASSET_CONFIRM").replace("%s", element.name),
                    cancelBtn = nls.localize("strings.LIBRARIES.BTN_CANCEL"),
                    confirmBtn = nls.localize("strings.LIBRARIES.BTN_DELETE");

                deleteConfirmationDialog = (
                    <LibraryDialog
                        title={dialogTitle}
                        body={body}
                        cancel={cancelBtn}
                        confirm={confirmBtn}
                        onConfirm={this._handleConfirmDeletion}
                        onCancel={this._handleCancelDeletion}/>
                );
            }
            
            var classNames = classnames({
                "libraries__asset": true,
                "libraries__asset-selected": this.props.selected
            }, this.props.classNames);

            return (
                <div className={classNames}
                     onClick={this._handleSelect}>
                    {this.props.children}
                    {deleteConfirmationDialog}
                    {sectionContent}
                </div>
            );
        }
    });

    module.exports = AssetSection;
});
