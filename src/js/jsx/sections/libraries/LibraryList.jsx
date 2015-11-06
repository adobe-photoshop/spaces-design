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
        _ = require("lodash"),
        Promise = require("bluebird"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React);
        
    var nls = require("js/util/nls"),
        headlights = require("js/util/headlights");

    var Datalist = require("jsx!js/jsx/shared/Datalist"),
        TextInput = require("jsx!js/jsx/shared/TextInput"),
        LibraryDialog = require("jsx!./LibraryDialog"),
        SplitButton = require("jsx!js/jsx/shared/SplitButton"),
        SplitButtonList = SplitButton.SplitButtonList,
        SplitButtonItem = SplitButton.SplitButtonItem;

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
        
        shouldComponentUpdate: function (nextProps, nextState) {
            return this.props.libraries !== nextProps.libraries ||
                   this.props.selected !== nextProps.selected ||
                   this.props.disabled !== nextProps.disabled ||
                   this.props.onLibraryChange !== nextProps.onLibraryChange ||
                   !_.isEqual(this.state, nextState);
        },

        componentDidUpdate: function () {
            if (this.refs.libraryNameInput) {
                window.setTimeout(function () {
                    var libraryNameInput = this.refs.libraryNameInput;
                    
                    // Check the existence of the input again, in case it is unmounted after the timeout.
                    if (libraryNameInput) {
                        libraryNameInput.acquireFocus();
                        React.findDOMNode(libraryNameInput).focus();
                    }
                }.bind(this), 250);
            }
        },

        /**
         * Handles the list item selection. 
         *
         * @private
         * @param {string} itemID - either libraryID or one of _LIBRARY_COMMANDS.
         * @return {boolean}
         */
        _handleSelectListItem: function (itemID) {
            if (_LIBRARY_COMMANDS.indexOf(itemID) === -1) {
                // itemID is libraryID.
                this.props.onLibraryChange(itemID);
                return true;
            }

            this.setState({ command: itemID });
            
            if (itemID === _CREATE_LIBRARY && this.props.onCreateLibrary) {
                this.props.onCreateLibrary(true);
            }

            // Return false to cancel the current selection.
            return false;
        },

        /**
         * Given the libraries, creates the datalist friendly
         * options for the library picker
         *
         * @private
         * @param {Immutable.Map.<string, AdobeLibraryComposite>} libraries
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
                        title: nls.localize("strings.LIBRARIES.CREATE_LIBRARY"),
                        searchable: false,
                        id: _CREATE_LIBRARY
                    }
                ];

            if (selectedLibrary) {
                var deleteLibraryText = selectedLibrary.collaboration === _INCOMING_LIBRARY ?
                        nls.localize("strings.LIBRARIES.LEAVE_LIBRARY") :
                        nls.localize("strings.LIBRARIES.DELETE_LIBRARY");

                options = options.concat([
                    {
                        title: nls.localize("strings.LIBRARIES.RENAME_LIBRARY")
                            .replace("%s", selectedLibrary.name),
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
         * Handle text input keydown event. If the key is Return/Enter, we call the onConfirm handler to either
         * create or rename a library.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleLibraryNameInputKeydown: function (event) {
            if (event.key === "Return" || event.key === "Enter") {
                this._handleConfirmCommand();
            } else if (event.key === "Escape") {
                this._handleCancelCommand();
            }
        },
        
        /**
         * Handle confirmation of current library commands (create / rename / delete).
         * 
         * @private
         */
        _handleConfirmCommand: function () {
            var libraryName = this.refs.libraryNameInput ? this.refs.libraryNameInput.getValue() : "",
                libraryActions = this.getFlux().actions.libraries,
                commandPromise = Promise.resolve();
            
            switch (this.state.command) {
                case _CREATE_LIBRARY:
                    if (libraryName.length !== 0) {
                        commandPromise = libraryActions.createLibrary(libraryName)
                            .bind(this)
                            .then(function () {
                                if (this.props.onCreateLibrary) {
                                    this.props.onCreateLibrary(false);
                                }
                            });
                    }
                    break;
                
                case _RENAME_LIBRARY:
                    if (libraryName.length !== 0) {
                        commandPromise = libraryActions.renameLibrary(this.props.selected.id, libraryName);
                        headlights.logEvent("libraries", "library", "update-library-info");
                    }
                    break;
                
                case _DELETE_LIBRARY:
                    commandPromise = libraryActions.removeLibrary(this.props.selected.id);
                    break;
            }
            
            commandPromise
                .bind(this)
                .then(function () {
                    this.setState({ command: null });
                });
        },

        /**
         * Cancel the current library command (create / rename / delete).
         *
         * @private
         */
        _handleCancelCommand: function () {
            if (this.state.command === _CREATE_LIBRARY && this.props.onCreateLibrary) {
                this.props.onCreateLibrary(false);
            }
            
            this.setState({ command: null });
        },
        
        /**
         * Handle library button clicked
         *
         * @private
         * @param {string} event - name of the click event
         * @param {string} url - url to open in the browser
         */
        _handleLibraryButtonClicked: function (event, url) {
            this.getFlux().actions.menu.openURL({
                category: "libraries",
                subcategory: "library",
                eventName: event,
                url: url
            });
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
            collaborationMapBody[_OUTGOING_LIBRARY] = nls.localize("strings.LIBRARIES.DELETE_SHARED_LIBRARY_CONFIRM");
            collaborationMapBody[_INCOMING_LIBRARY] = nls.localize("strings.LIBRARIES.LEAVE_LIBRARY_CONFIRM");
            collaborationMapBody[_REGULAR_LIBRARY] = nls.localize("strings.LIBRARIES.DELETE_LIBRARY_CONFIRM");

            var selectedLibrary = this.props.selected,
                body = collaborationMapBody[selectedLibrary.collaboration].replace("%s", selectedLibrary.name),
                cancelBtn = nls.localize("strings.LIBRARIES.BTN_CANCEL"),
                isIncomingLibrary = selectedLibrary.collaboration === _INCOMING_LIBRARY,
                confirmBtn = isIncomingLibrary ?
                    nls.localize("strings.LIBRARIES.BTN_LEAVE") :
                    nls.localize("strings.LIBRARIES.BTN_DELETE"),
                title = isIncomingLibrary ?
                    nls.localize("strings.LIBRARIES.LEAVE_LIBRARY") :
                    nls.localize("strings.LIBRARIES.DELETE_LIBRARY");

            return (<LibraryDialog
                title={title}
                body={body}
                confirm={confirmBtn}
                cancel={cancelBtn}
                onConfirm={this._handleConfirmCommand}
                onCancel={this._handleCancelCommand}/>);
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
                selectedLibraryID = selectedLibrary && selectedLibrary.id;

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
                    ref="list"
                    list="libraries"
                    className="dialog-libraries"
                    options={listOptions}
                    value={selectedLibraryName}
                    live={false}
                    autoSelect={false}
                    onChange={this._handleSelectListItem}
                    releaseOnBlur={true}
                    defaultSelected={selectedLibraryID}
                    disabled={this.props.disabled} />
                <SplitButtonList className="libraries__split-button-list">
                    <SplitButtonItem
                        title={nls.localize("strings.TOOLTIPS.LIBRARY_SHARE")}
                        iconId="libraries-collaborate"
                        className={isSharedLibrary && "libraries__split-button-collaborate"}
                        disabled={!selectedLibrary}
                        onClick={this._handleLibraryButtonClicked.bind(this, "share-library", collaborateLink)} />
                    <SplitButtonItem
                        title={nls.localize("strings.TOOLTIPS.LIBRARY_SEND_LINK")}
                        iconId="libraries-share"
                        disabled={!selectedLibrary}
                        onClick={this._handleLibraryButtonClicked.bind(this, "share-public-link", shareLink)} />
                    <SplitButtonItem
                        title={nls.localize("strings.TOOLTIPS.LIBRARY_VIEW_ON_WEBSITE")}
                        iconId="libraries-viewonsite"
                        disabled={!selectedLibrary}
                        onClick={this._handleLibraryButtonClicked.bind(this, "view-online", libraryLink)} />
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
                inputDefaultValue = isInRenameMode ? this.props.selected.name : "",
                confirmBtnText = isInRenameMode ?
                    nls.localize("strings.LIBRARIES.BTN_RENAME") :
                    nls.localize("strings.LIBRARIES.BTN_CREATE");

            return (<div className="libraries__bar__top__content libraries__bar__top__content-input">
                <TextInput
                    ref="libraryNameInput"
                    type="text"
                    live={true}
                    continuous={true}
                    className="libraires__bar__input"
                    value={inputDefaultValue}
                    placeholderText={nls.localize("strings.LIBRARIES.LIBRARY_NAME")}
                    onKeyDown={this._handleLibraryNameInputKeydown}/>
                <div className="libraries__bar__btn-cancel"
                     onClick={this._handleCancelCommand}>
                    {nls.localize("strings.LIBRARIES.BTN_CANCEL")}
                </div>
                <div className="libraries__bar__btn-confirm"
                     onClick={this._handleConfirmCommand}>
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
