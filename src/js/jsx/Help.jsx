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

    var Dialog = require("jsx!./shared/Dialog"),
        FirstLaunch = require("jsx!./help/FirstLaunch"),
        os = require("adapter/os");

    var FIRST_LAUNCH_DIALOG_ID = "firstLaunchDialog";
        
    var Help = React.createClass({
        mixins: [FluxMixin],

        _closeFirstLaunch: function () {
            this.getFlux().actions.dialog.closeDialog(FIRST_LAUNCH_DIALOG_ID);
        },

        render: function () {

            // Is it possible for the dialog component to "implant" a property in each child?
            // (using React.Children.forEach) (http://jaketrent.com/post/send-props-to-children-react/)
            // could it dynamically provide a function "closeMe" that would allow the child to close the dialog?
            // thus removing the need for this awkward dismissDialog prop to be handled outside

            return (
                <Dialog
                    ref={FIRST_LAUNCH_DIALOG_ID}
                    id={FIRST_LAUNCH_DIALOG_ID}
                    modal
                    position={Dialog.POSITION_METHODS.CENTER}
                    dismissOnCanvasClick={true}
                    dismissOnWindowClick={true}
                    dismissOnKeys={[{key: os.eventKeyCode.ESCAPE, modifiers: null}]}
                    className={"first-launch__dialog"} >
                    <FirstLaunch 
                        dismissDialog={this._closeFirstLaunch}/>

                </Dialog>
            );
        }

    });

    module.exports = Help;
});
