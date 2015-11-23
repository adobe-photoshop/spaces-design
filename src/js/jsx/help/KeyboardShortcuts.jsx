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
        _ = require("lodash");

    var system = require("js/util/system"),
        nls = require("js/util/nls"),
        Button = require("js/jsx/shared/Button"),
        SVGIcon = require("js/jsx/shared/SVGIcon");
        
    var KeyboardShortcuts = React.createClass({

        propTypes: {
            dismissDialog: React.PropTypes.func
        },

        getDefaultProps: function () {
            return {
                dismissDialog: _.identity
            };
        },
  
        /**
         * Dismiss the parent dialog, and also set a preference flag based on doNotShowAgain
         *
         * @param {SyntheticEvent} event
         */
        _dismissDialog: function (event) {
            if (_.isFunction(this.props.dismissDialog)) {
                this.props.dismissDialog(event);
            }
        },

        /**
         * Helper function to translate shortcut related strings
         *
         * @private
         *
         * @param {string} key Key for the string in strings.KEYBOARD_SHORTCUTS tree
         * @return {string} Localized result
         */
        _translate: function (key) {
            return nls.localize("strings.KEYBOARD_SHORTCUTS." + key);
        },

        render: function () {
            var holdSelectionInstruction = system.isMac ?
                    this._translate("SELECT_TOOL.HOLD_SEL_MAC") :
                    this._translate("SELECT_TOOL.HOLD_SEL_WIN"),
                targetLayerInstruction = system.isMac ?
                    this._translate("SELECT_TOOL.TARGET_LAYER_MAC") :
                    this._translate("SELECT_TOOL.TARGET_LAYER_WIN"),
                searchInstruction = system.isMac ?
                    this._translate("TOOLS.SEARCH_INSTRUCTION_MAC") :
                    this._translate("TOOLS.SEARCH_INSTRUCTION_WIN"),
                exportInstruction = system.isMac ?
                    this._translate("TOOLS.EXPORT_INSTRUCTION_MAC") :
                    this._translate("TOOLS.EXPORT_INSTRUCTION_WIN");
            
            return (
                <div className="keyboard-shortcut__content" onClick={this._dismissDialog}>
                    <div className="keyboard-shortcut__column-1">
                        <h2 className="keyboard-shortcut__title">{this._translate("TOOLS_TITLE")}</h2>
                        <ul className="keyboard-shortcut__list">
                            <li>
                                <Button>
                                    <SVGIcon CSSID="tool-newSelect" />
                                </Button>
                                <span className="keyboard-shortcut__name">
                                    
                                    {this._translate("TOOLS.SELECT")}
                                </span>
                                <span className="keyboard-shortcut__instr">V</span>
                            </li>
                            <li>
                                <Button>
                                    <SVGIcon CSSID="tool-rectangle" />
                                </Button>
                                <span className="keyboard-shortcut__name">{this._translate("TOOLS.RECTANGLE")}</span>
                                <span className="keyboard-shortcut__instr">R</span>
                            </li>
                            <li>
                                <Button>
                                    <SVGIcon CSSID="tool-ellipse" />
                                </Button>
                                <span className="keyboard-shortcut__name">{this._translate("TOOLS.ELLIPSE")}</span>
                                <span className="keyboard-shortcut__instr">E</span>
                            </li>
                            <li>
                                <Button>
                                    <SVGIcon CSSID="tool-pen" />
                                </Button>
                                <span className="keyboard-shortcut__name">{this._translate("TOOLS.PEN")}</span>
                                <span className="keyboard-shortcut__instr">P</span>
                            </li>
                            <li>
                                <Button>
                                    <SVGIcon CSSID="tool-typeCreateOrEdit" />
                                </Button>
                                <span className="keyboard-shortcut__name">{this._translate("TOOLS.TYPE")}</span>
                                <span className="keyboard-shortcut__instr">T</span>
                            </li>
                            <li>
                                <Button>
                                    <SVGIcon CSSID="tool-eyedropper" />
                                </Button>
                                <span className="keyboard-shortcut__name">{this._translate("TOOLS.SAMPLER")}</span>
                                <span className="keyboard-shortcut__instr">I</span>
                            </li>
                            <li>
                                <span className="keyboard-shortcut__name">
                                    &nbsp;&nbsp;&nbsp;&nbsp;{this._translate("TOOLS.SAMPLER_EFFECTS")}
                                </span>
                                <span className="keyboard-shortcut__instr">
                                    {this._translate("TOOLS.SAMPLER_INSTRUCTION_EFFECTS")}
                                </span>
                            </li>
                            <li>
                                <span className="keyboard-shortcut__name">
                                    &nbsp;&nbsp;&nbsp;&nbsp;{this._translate("TOOLS.SAMPLER_HUD")}
                                </span>
                                <span className="keyboard-shortcut__instr">
                                    {this._translate("TOOLS.SAMPLER_INSTRUCTION_HUD")}
                                </span>
                            </li>
                        </ul>
                        <h2 className="keyboard-shortcut__title">{this._translate("MORE_TITLE")}</h2>
                        <ul className="keyboard-shortcut__list">
                            <li>
                                <Button>
                                    <SVGIcon CSSID="layer-search-app" />
                                </Button>
                                <span className="keyboard-shortcut__name">{this._translate("TOOLS.SEARCH")}</span>
                                <span className="keyboard-shortcut__instr">
                                    {searchInstruction}
                                </span>
                            </li>
                            <li>
                                <Button>
                                    <SVGIcon CSSID="tool-maskmode" />
                                </Button>
                                <span className="keyboard-shortcut__name">{this._translate("TOOLS.MASKMODE")}</span>
                                <span className="keyboard-shortcut__instr">M</span>
                            </li>
                            <li>
                                <Button>
                                    <SVGIcon CSSID="extract-all" />
                                </Button>
                                <span className="keyboard-shortcut__name">{this._translate("TOOLS.EXPORT")}</span>
                                <span className="keyboard-shortcut__instr">
                                    {exportInstruction}
                                </span>
                            </li>
                        </ul>
                    </div>
                    <div className="keyboard-shortcut__column-2">
                        <h2 className="keyboard-shortcut__title">{this._translate("SELECT_TITLE")}</h2>
                        <ul className="keyboard-shortcut__list">
                            <li>
                                <span className="keyboard-shortcut__name">
                                    {this._translate("SELECT_TOOL.TARGET")}
                                </span>
                                <span className="keyboard-shortcut__instr">
                                    {this._translate("SELECT_TOOL.TARGET_INSTRUCTION")}
                                </span>
                            </li>
                            <li>
                                <span className="keyboard-shortcut__name">
                                    {this._translate("SELECT_TOOL.EDIT_PATH")}
                                </span>
                                <span className="keyboard-shortcut__instr">
                                    {this._translate("SELECT_TOOL.EDIT_PATH_INSTRUCTION")}
                                </span>
                            </li>
                            <li>
                                <span className="keyboard-shortcut__name">
                                    {this._translate("SELECT_TOOL.EDIT_SMART")}
                                </span>
                                <span className="keyboard-shortcut__instr">
                                    {this._translate("SELECT_TOOL.EDIT_SMART_INSTRUCTION")}
                                </span>
                            </li>
                            <li>
                                <span className="keyboard-shortcut__name">
                                    {this._translate("SELECT_TOOL.BACK_OUT")}
                                </span>
                                <span className="keyboard-shortcut__instr">
                                    {this._translate("SELECT_TOOL.BACK_OUT_INSTRUCTION")}
                                </span>
                            </li>
                            <li>
                                <span className="keyboard-shortcut__name">
                                    {this._translate("SELECT_TOOL.HOLD_SELECTION")}
                                </span>
                                <span className="keyboard-shortcut__instr">
                                    {holdSelectionInstruction}
                                </span>
                            </li>
                            <li>
                                <span className="keyboard-shortcut__name">
                                    {this._translate("SELECT_TOOL.TARGET_LAYER")}
                                </span>
                                <span className="keyboard-shortcut__instr">
                                    {targetLayerInstruction}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            );
        }
    });

    module.exports = KeyboardShortcuts;
});
