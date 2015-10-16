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

define(function (require, exports) {
    "use strict";

    var Promise = require("bluebird");

    var os = require("adapter/os");

    var events = require("../events"),
        log = require("js/util/log"),
        keyUtil = require("js/util/key");

    /**
     * Construct a semantic event from an adapter event.
     * 
     * @private
     * @param {{eventKind: number, keyCode: number=, keyChar: string=, modifiers: number}} event
     * @return {{keyCode: number=, keyChar: string=, modifiers: object}}
     */
    var _getEventDetail = function (event) {
        var detail = {
            modifierBits: event.modifiers,
            modifiers: keyUtil.bitsToModifiers(event.modifiers)
        };

        if (event.keyChar) {
            detail.keyChar = event.keyChar;
        } else if (event.hasOwnProperty("keyCode")) {
            detail.keyCode = event.keyCode;
        } else {
            switch (event.eventKind) {
            case os.eventKind.KEY_DOWN:
            case os.eventKind.KEY_UP:
                log.warn("Adapter key event has no key specification", event);
            }
        }

        return detail;
    };

    /**
     * Handler for EXTERNAL_KEYEVENT, used in beforeStartup.
     *
     * @private
     * @param {object} event
     */
    var _externalKeyEventHandler = function (event) {
        var type;
        switch (event.eventKind) {
        case os.eventKind.KEY_DOWN:
            type = "adapterKeydown";
            break;
        case os.eventKind.KEY_UP:
            type = "adapterKeyup";
            break;
        case os.eventKind.FLAGS_CHANGED:
            type = "adapterFlagsChanged";
            break;
        default:
            return;
        }

        var domEvent = new window.CustomEvent(type, {
            bubbles: true,
            detail: _getEventDetail(event)
        });

        window.document.activeElement.dispatchEvent(domEvent);
    };

    /**
     * Flags change handler that emits MODIFIERS_CHANGED.
     *
     * @private
     * @type {function(SyntheticEvent)}
     */
    var _handleFlagsChanged;

    /**
     * Clears modifier state when the application becomes inactive.
     *
     * @private
     * @type {function({{becameActive: boolean}})}
     */
    var _handleActivationChanged;

    /**
     * Registers a key event handler to reflect adapter events back to the DOM.
     * 
     * @return {Promise}
     */
    var beforeStartup = function () {
        os.addListener(os.notifierKind.EXTERNAL_KEYEVENT, _externalKeyEventHandler);

        _handleActivationChanged = function (event) {
            if (!event.becameActive) {
                // The modifier state becomes invalid when the application becomes inactive.
                // To avoid having stale modifier state when the application becomes active
                // again, just reset the state immediately. Ideally, the adapter would also
                // send another adapterFlagsChanged event whenever the application becomes
                // active so that the modifier state can be updated immediately. If not, it
                // will be null until the first new adapterFlagsChanged event, which is
                // less bad than having stale modifier state. For details, see #2946.
                this.dispatch(events.modifiers.MODIFIERS_CHANGED, {});
            }
        }.bind(this);
        os.addListener("activationChanged", _handleActivationChanged);

        _handleFlagsChanged = function (event) {
            this.dispatch(events.modifiers.MODIFIERS_CHANGED, event.detail.modifiers);
        }.bind(this);

        window.addEventListener("adapterFlagsChanged", _handleFlagsChanged);

        return Promise.resolve();
    };
    beforeStartup.reads = [];
    beforeStartup.writes = [];

    /**
     * Remove event handlers.
     *
     * @private
     * @return {Promise}
     */
    var onReset = function () {
        os.removeListener(os.notifierKind.EXTERNAL_KEYEVENT, _externalKeyEventHandler);
        os.removeListener("activationChanged", _handleActivationChanged);
        window.removeEventListener("adapterFlagsChanged", _handleFlagsChanged);

        return Promise.resolve();
    };
    onReset.reads = [];
    onReset.writes = [];

    exports.beforeStartup = beforeStartup;
    exports.onReset = onReset;
});
