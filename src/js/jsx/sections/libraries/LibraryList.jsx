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
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem,
        LibraryDialog = require("jsx!./LibraryDialog"),
        strings = require("i18n!nls/strings");

    // TODO doc
    var _CREATE_LIBRARY = "CREATE_LIBRARY",
        _DELETE_LIBRARY = "DELETE_LIBRARY",
        _RENAME_LIBRARY = "RENAME_LIBRARY",
        _LIBRARY_COMMANDS = [_CREATE_LIBRARY, _DELETE_LIBRARY, _RENAME_LIBRARY];

    // TODO docs
    // a library that the user owns, and has shared with others
    // a library belonging to another user, that has been shared with this user
    // not collaborated
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
         */
        _handleChange: function (libraryID) {
            if (_LIBRARY_COMMANDS.indexOf(libraryID) === -1) {
                this.props.onLibraryChange(libraryID);
                return;
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
         * @param {Array.<AdobeLibraryComposite>} libraries
         *
         * @private
         * @return {{title: String, id: string}}
         */
        _getLibraryList: function (libraries) {
            return libraries.map(function (library) {
                return {
                    title: library.name,
                    id: library.id
                };
            }).toList();
        },

        /**
         * Return library commands based on currently selected library.
         *
         * @private
         * @return {{title: String, id: string, type?: string }}
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

        _handleNameInput: function (event, newName) {
            this.setState({
                newLibraryName: newName
            });
        },

        _handleCreate: function () {
            if (this.state.newLibraryName.length === 0) {
                return;
            }

            this.getFlux().actions.libraries.createLibrary(this.state.newLibraryName);
            this.setState({ command: null });
        },

        _handleRename: function () {
            if (this.state.newLibraryName.length === 0) {
                return;
            }

            this.getFlux().actions.libraries.renameLibrary(this.props.selected.id, this.state.newLibraryName);
            this.setState({ command: null });
        },

        _handleDelete: function () {
            this.getFlux().actions.libraries.removeLibrary(this.props.selected.id);
            this.setState({ command: null });
        },

        _handleCancel: function () {
            this.setState({ command: null });
        },

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

        _renderLibraryList: function () {
            if (this.state.command && this.state.command !== _DELETE_LIBRARY) {
                return null;
            }

            var libraryOptions = this._getLibraryList(this.props.libraries),
                libraryCommandOptions = this._getLibraryCommandOptions(),
                listOptions = libraryOptions.concat(libraryCommandOptions),
                selectedLibraryName = this.props.selected && this.props.selected.name,
                selectedLibraryID = this.props.selected && this.props.selected.id,
                listID = "libraries-" + this.props.document.id;

            return (<div className="libraries__bar__top__content">
                <Datalist
                    list={listID}
                    className="dialog-libraries"
                    options={listOptions}
                    value={selectedLibraryName}
                    live={false}
                    autoSelect={false}
                    onChange={this._handleChange}
                    defaultSelected={selectedLibraryID}
                    disabled={this.props.disabled} />
                <SplitButtonList className="libraries__split-button-list">
                    <SplitButtonItem
                        title={strings.TOOLTIPS.LIBRARY_SHARE}
                        iconId="libraries-collaborate"
                        disabled={true} />
                    <SplitButtonItem
                        title={strings.TOOLTIPS.LIBRARY_SEND_LINK}
                        iconId="libraries-share"
                        disabled={true} />
                    <SplitButtonItem
                        title={strings.TOOLTIPS.LIBRARY_VIEW_ON_WEBSITE}
                        iconId="libraries-viewonsite"
                        disabled={true} />
                </SplitButtonList>
            </div>);
        },

        _renderLibraryNameInput: function () {
            var command = this.state.command;

            if (!command || command === _DELETE_LIBRARY) {
                return null;
            }

            var rename = command === _RENAME_LIBRARY;

            return (<div className="libraries__bar__top__content libraries__bar__top__content-input">
                <TextInput
                    ref="input"
                    type="text"
                    live={true}
                    continuous={true}
                    className="libraires__bar__input"
                    value={this.state.newLibraryName}
                    placeholderText={strings.LIBRARIES.LIBRARY_NAME}
                    onChange={this._handleNameInput}/>
                <div className="libraries__bar__btn-cancel"
                     onClick={this._handleCancel}>
                    {strings.LIBRARIES.BTN_CANCEL}
                </div>
                <div className="libraries__bar__btn-confirm"
                     onClick={rename ? this._handleRename : this._handleCreate}>
                    {rename ? strings.LIBRARIES.BTN_RENAME : strings.LIBRARIES.BTN_CREATE}
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
