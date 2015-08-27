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

    var Datalist = require("jsx!js/jsx/shared/Datalist"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        LibraryDialog = require("jsx!./LibraryDialog"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        ui = require("js/util/ui"),
        strings = require("i18n!nls/strings");

    /**
     * Commands of the bottom three items in the dropdown menu.
     *
     * @const
     * @private
     */
    var _CREATE_LIBRARY = "CREATE_LIBRARY",
        _DELETE_LIBRARY = "DELETE_LIBRARY",
        _RENAME_LIBRARY = "RENAME_LIBRARY",
        _LIBRARY_COMMANDS = [_CREATE_LIBRARY, _DELETE_LIBRARY, _RENAME_LIBRARY];

    /**
     * List library collaboration status.
     *
     * _OUTGOING_LIBRARY: a library that the user owns, and has shared with others
     * _INCOMING_LIBRARY: a library belonging to another user, that has been shared with this user
     * _REGULAR_LIBRARY: not collaborated
     *
     * @const
     * @private
     */
    var _OUTGOING_LIBRARY = "outgoing",
        _INCOMING_LIBRARY = "incoming",
        _REGULAR_LIBRARY; // intended to be undefined

    var LibraryList = React.createClass({
        mixins: [FluxMixin],

        getInitialState: function () {
            return {
                command: null
            };
        },

        componentDidUpdate: function () {
            if (this.refs.input) {
                this.refs.input.getDOMNode().focus();
            }
        },

        /**
         * Handles the item selection
         * Later on, we'll have "add new library" item in this list
         *
         * @private
         * @param {string} libraryID Selected item ID
         * @return {boolean}
         */
        _handleChangeLibrary: function (libraryID) {
            if (_LIBRARY_COMMANDS.indexOf(libraryID) === -1) {
                this.props.onLibraryChange(libraryID);
                return true;
            }

            var selectedCommand = libraryID,
                newLibraryName = selectedCommand === _RENAME_LIBRARY ? this.props.selected.name : "";

            this.setState({
                command: selectedCommand,
                newLibraryName: newLibraryName
            });

            // Cancel Datalist selection
            return false;
        },

        /**
         * Given the libraries, creates the datalist friendly
         * options for the library picker
         *
         * @private
         * @param {Array.<AdobeLibraryComposite>} libraries
         * @return {{title: String, id: string, svgType?: string, className?: string}}
         */
        _getLibraryList: function (libraries) {
            return libraries
                .sort(function (a, b) { return b.modified - a.modified; })
                .map(function (library) {
                    var shared = library.collaboration !== _REGULAR_LIBRARY;

                    return {
                        title: library.name,
                        id: library.id,
                        svgType: shared ? "libraries-collaborate" : null,
                        className: shared ? "select__option-library" : null
                    };
                }).toList();
        },

        /**
         * Return library commands based on currently selected library.
         *
         * @private
         * @return {{title: String, id: string, type?: string, searchable: boolean }}
         */
        _getLibraryCommandOptions: function () {
            var selectedLibrary = this.props.selected,
                options = [
                    {
                        type: "placeholder",
                        searchable: false,
                        id: "divider"
                    },
                    {
                        title: strings.LIBRARIES.CREATE_LIBRARY,
                        searchable: false,
                        id: _CREATE_LIBRARY
                    }
                ];

            if (selectedLibrary) {
                var deleteLibraryText = selectedLibrary.collaboration === _INCOMING_LIBRARY ?
                        strings.LIBRARIES.LEAVE_LIBRARY : strings.LIBRARIES.DELETE_LIBRARY;

                options = options.concat([
                    {
                        title: strings.LIBRARIES.RENAME_LIBRARY.replace("%s", selectedLibrary.name),
                        searchable: false,
                        id: _RENAME_LIBRARY
                    },
                    {
                        title: deleteLibraryText.replace("%s", selectedLibrary.name),
                        searchable: false,
                        id: _DELETE_LIBRARY
                    }
                ]);
            }

            return options;
        },

        /**
         * Handle change of current library's name. The new name is not committed yet.
         *
         * @private
         * @param  {SyntheticEvent} event
         * @param  {string} newName
         */
        _handleChangeName: function (event, newName) {
            this.setState({
                newLibraryName: newName
            });
        },

        /**
         * Invoke libraries action to change the current library's name.
         *
         * @private
         */
        _handleRename: function () {
            if (this.state.newLibraryName.length !== 0) {
                this.getFlux().actions.libraries.renameLibrary(this.props.selected.id, this.state.newLibraryName);
                this.setState({ command: null });
            }
        },

        /**
         * Invoke libraries action to create a library
         *
         * @private
         */
        _handleCreate: function () {
            if (this.state.newLibraryName.length !== 0) {
                this.getFlux().actions.libraries.createLibrary(this.state.newLibraryName);
                this.setState({ command: null });
            }
        },

        /**
         * Invoke libraries action to delete the current library
         *
         * @private
         */
        _handleDelete: function () {
            this.getFlux().actions.libraries.removeLibrary(this.props.selected.id);
            this.setState({ command: null });
        },

        /**
         * Cancel the current library command (create / rename / delete).
         *
         * @private
         */
        _handleCancel: function () {
            this.setState({ command: null });
        },

        /**
         * Render confirmation dialog for deleting the current library.
         *
         * @private
         * @return {?ReactComponent}
         */
        _renderDeleteConfirmationDialog: function () {
            if (this.state.command !== _DELETE_LIBRARY) {
                return null;
            }

            var collaborationMapBody = {};
            collaborationMapBody[_OUTGOING_LIBRARY] = strings.LIBRARIES.DELETE_SHARED_LIBRARY_CONFIRM;
            collaborationMapBody[_INCOMING_LIBRARY] = strings.LIBRARIES.LEAVE_LIBRARY_CONFIRM;
            collaborationMapBody[_REGULAR_LIBRARY] = strings.LIBRARIES.DELETE_LIBRARY_CONFIRM;

            var selectedLibrary = this.props.selected,
                title = strings.LIBRARIES.DELETE_LIBRARY.replace("%s", selectedLibrary.name),
                body = collaborationMapBody[selectedLibrary.collaboration].replace("%s", selectedLibrary.name),
                cancelBtn = strings.LIBRARIES.BTN_CANCEL,
                confirmBtn = selectedLibrary.collaboration === _INCOMING_LIBRARY ?
                    strings.LIBRARIES.BTN_LEAVE : strings.LIBRARIES.BTN_DELETE;

            return (<LibraryDialog
                title={title}
                body={body}
                confirm={confirmBtn}
                cancel={cancelBtn}
                onConfirm={this._handleDelete}
                onCancel={this._handleCancel}/>);
        },

        /**
         * Render the libraries list
         *
         * @private
         * @return {?ReactComponent}
         */
        _renderLibraryList: function () {
            if (this.state.command && this.state.command !== _DELETE_LIBRARY) {
                return null;
            }

            var libraryOptions = this._getLibraryList(this.props.libraries),
                libraryCommandOptions = this._getLibraryCommandOptions(),
                listOptions = libraryOptions.concat(libraryCommandOptions),
                selectedLibrary = this.props.selected,
                selectedLibraryName = selectedLibrary && selectedLibrary.name,
                selectedLibraryID = selectedLibrary && selectedLibrary.id,
                listID = "libraries-" + this.props.document.id;

            var isSharedLibrary = false,
                libraryLink,
                shareLink,
                collaborateLink;

            if (selectedLibrary) {
                isSharedLibrary = selectedLibrary.collaboration !== _REGULAR_LIBRARY;
                libraryLink = "https://assets.adobe.com/assets/libraries/" + selectedLibrary.id;
                shareLink = libraryLink + "?dialog=share";
                collaborateLink = libraryLink + "?dialog=collaborate";
            }

            return (<div className="libraries__bar__top__content">
                <Datalist
                    list={listID}
                    className="dialog-libraries"
                    options={listOptions}
                    value={selectedLibraryName}
                    live={false}
                    autoSelect={false}
                    onChange={this._handleChangeLibrary}
                    defaultSelected={selectedLibraryID}
                    disabled={this.props.disabled} />
                <SplitButtonList className="libraries__split-button-list">
                    <SplitButtonItem
                        title={strings.TOOLTIPS.LIBRARY_SHARE}
                        iconId="libraries-collaborate"
                        className={isSharedLibrary && "libraries__split-button-collaborate"}
                        disabled={!selectedLibrary}
                        onClick={ui.openURL.bind(null, collaborateLink)} />
                    <SplitButtonItem
                        title={strings.TOOLTIPS.LIBRARY_SEND_LINK}
                        iconId="libraries-share"
                        disabled={!selectedLibrary}
                        onClick={ui.openURL.bind(null, shareLink)} />
                    <SplitButtonItem
                        title={strings.TOOLTIPS.LIBRARY_VIEW_ON_WEBSITE}
                        iconId="libraries-viewonsite"
                        disabled={!selectedLibrary}
                        onClick={ui.openURL.bind(null, libraryLink)} />
                </SplitButtonList>
            </div>);
        },

        /**
         * Render text input and buttons for creating a library or renaming the current library.
         *
         * @private
         * @return {?ReactComponent}
         */
        _renderLibraryNameInput: function () {
            var command = this.state.command;

            if (!command || command === _DELETE_LIBRARY) {
                return null;
            }

            var isInRenameMode = command === _RENAME_LIBRARY,
                onConfirmHandler = isInRenameMode ? this._handleRename : this._handleCreate,
                confirmBtnText = isInRenameMode ? strings.LIBRARIES.BTN_RENAME : strings.LIBRARIES.BTN_CREATE;

            return (<div className="libraries__bar__top__content libraries__bar__top__content-input">
                <TextInput
                    ref="input"
                    type="text"
                    live={true}
                    continuous={true}
                    className="libraires__bar__input"
                    value={this.state.newLibraryName}
                    placeholderText={strings.LIBRARIES.LIBRARY_NAME}
                    onChange={this._handleChangeName}/>
                <div className="libraries__bar__btn-cancel"
                     onClick={this._handleCancel}>
                    {strings.LIBRARIES.BTN_CANCEL}
                </div>
                <div className="libraries__bar__btn-confirm"
                     onClick={onConfirmHandler}>
                    {confirmBtnText}
                </div>
            </div>);
        },

        render: function () {
            var deleteConfirmationDialog = this._renderDeleteConfirmationDialog(),
                libraryInput = this._renderLibraryNameInput(),
                libraryList = this._renderLibraryList();

            return (
                <div className="libraries__bar libraries__bar__top">
                    {deleteConfirmationDialog}
                    {libraryInput}
                    {libraryList}
                </div>
            );
        }
    });

    module.exports = LibraryList;
});
