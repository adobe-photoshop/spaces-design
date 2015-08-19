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

    var strings = require("i18n!nls/strings"),
        ui = require("js/util/ui");

    var LibraryDialog = require("jsx!js/jsx/sections/libraries/LibraryDialog"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem;

    var AssetSection = React.createClass({
        mixins: [FluxMixin],

        propTypes: {
            element: React.PropTypes.object.isRequired,
            onSelect: React.PropTypes.func
        },

        getInitialState: function () {
            return {
                deleting: false
            };
        },

        /**
         * Handle select asset event.
         * @param  {SynthenticEvent} event
         *
         * @private
         */
        _handleSelect: function (event) {
            if (event.target !== React.findDOMNode(this)) {
                return;
            }

            if (this.props.onSelect) {
                this.props.onSelect(this.props.element);
            }
        },

        /**
         * Handle rename asset event.
         * @param  {SynthenticEvent} event
         *
         * @private
         */
        _handleRename: function (event) {
            event.stopPropagation();
            // FIXME: Implement
        },

        _handleDelete: function () {
            this.setState({ deleting: true });
        },

        _handleCancelDeletion: function () {
            this.setState({ deleting: false });
        },

        _handleConfirmDeletion: function () {
            this.getFlux().actions.libraries.removeAsset(this.props.element);
            this.setState({ deleting: false });
        },

        render: function () {
            var sectionContent,
                deleteConfirmationDialog;

            if (this.props.selected) {
                var element = this.props.element,
                    library = element.library,
                    elementLink = ["https://assets.adobe.com/assets/libraries", library.id, element.id].join("/"),
                    shareLink = elementLink + "?dialog=share";

                sectionContent = (
                    <SplitButtonList className="libraries__asset__buttons">
                        <SplitButtonItem
                            title={strings.TOOLTIPS.LIBRARY_DELETE}
                            iconId="delete"
                            onClick={this._handleDelete} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.LIBRARY_SEND_LINK}
                            iconId="libraries-share"
                            onClick={ui.openURL.bind(null, shareLink)} />
                        <SplitButtonItem
                            title={strings.TOOLTIPS.LIBRARY_VIEW_ON_WEBSITE}
                            iconId="libraries-viewonsite"
                            onClick={ui.openURL.bind(null, elementLink)} />
                    </SplitButtonList>
                );
            } else {
                sectionContent = React.cloneElement(this.props.children, { onDoubleClick: this._handleRename });
            }

            if (this.state.deleting) {
                var element = this.props.element,
                    title = strings.LIBRARIES.DELETE_ASSET.replace("%s", element.name),
                    body = strings.LIBRARIES.DELETE_ASSET_CONFIRM.replace("%s", element.name),
                    cancelBtn = strings.LIBRARIES.BTN_CANCEL,
                    confirmBtn = strings.LIBRARIES.BTN_DELETE;

                deleteConfirmationDialog = (<LibraryDialog
                    title={title}
                    body={body}
                    cancel={cancelBtn}
                    confirm={confirmBtn}
                    onConfirm={this._handleConfirmDeletion}
                    onCancel={this._handleCancelDeletion}/>);
            }

            return (
                <div className="libraries__asset__section"
                     onClick={this._handleSelect}>
                    {deleteConfirmationDialog}
                    {sectionContent}
                </div>
            );
        }
    });

    module.exports = AssetSection;
});
