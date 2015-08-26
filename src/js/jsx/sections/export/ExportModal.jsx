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

    var os = require("adapter/os");

    var Dialog = require("jsx!js/jsx/shared/Dialog"),
        ExportAllPanel = require("jsx!./ExportAllPanel");

    var ExportsModal = React.createClass({
        mixins: [FluxMixin],

        /**
         * Dismiss this dialog via export.closeExportPanel
         *
         * @private
         * @return {Promise}
         */
        _dismissDialog: function () {
            return this.getFlux().actions.export.closeExportPanel();
        },

        render: function () {
            return (
                <Dialog
                    id="exports-panel-dialog"
                    modal
                    position={Dialog.POSITION_METHODS.CENTER}
                    dismissOnCanvasClick={true}
                    dismissOnWindowClick={true}
                    dismissOnWindowResize={false}
                    dismissOnKeys={ [{ key: os.eventKeyCode.ESCAPE, modifiers: null }] }
                    className={"exports-panel__dialog"} >

                    <ExportAllPanel
                        dismissDialog={this._dismissDialog} />

                </Dialog>
            );
        }
    });

    module.exports = ExportsModal;
});
