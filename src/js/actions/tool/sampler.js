/*
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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

import * as Promise from "bluebird";
import * as _ from "lodash";

import { os as OS, ps } from "adapter";

import * as events from "js/events";
import * as policyActions from "js/actions/policy";
import * as PolicyStore from "js/stores/policy";
import * as locks from "js/locks";

var UI = ps.ui;

/** @ignore */
var _mouseMoveHandler;

/**
 * Track mouse movements and set the pointer propagation mode.
 *
 * @return {Promise}
 */
export var select = function () {
    _mouseMoveHandler = _.throttle(function (event) {
        this.dispatch(events.panel.MOUSE_POSITION_CHANGED, {
            currentMouseX: event.location[0],
            currentMouseY: event.location[1]
        });
    }.bind(this), 200);

    OS.addListener("externalMouseMove", _mouseMoveHandler);

    return this.transfer(policyActions.setMode, PolicyStore.eventKind.POINTER,
        UI.pointerPropagationMode.PROPAGATE_BY_ALPHA_AND_NOTIFY);
};
select.action = {
    reads: [],
    writes: [],
    transfers: ["policy.setMode"],
    modal: true
};

/**
 * Stop tracking mouse movements and hide the HUD.
 *
 * @return {Promise}
 */
export var deselect = function () {
    OS.removeListener("externalMouseMove", _mouseMoveHandler);

    var mousePositionPromise = this.dispatchAsync(events.panel.MOUSE_POSITION_CHANGED, null),
        hideHUDPromise = this.dispatchAsync(events.style.HIDE_HUD)
            .bind(this)
            .then(function () {
                return this.transfer(policyActions.setMode, PolicyStore.eventKind.POINTER,
                    UI.pointerPropagationMode.PROPAGATE_BY_ALPHA);
            });

    return Promise.join(mousePositionPromise, hideHUDPromise);
};
deselect.action = {
    reads: [],
    writes: [locks.JS_PANEL],
    transfers: ["policy.setMode"],
    modal: true
};
