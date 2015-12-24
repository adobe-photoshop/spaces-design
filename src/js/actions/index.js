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

// namespaced raw (unsynchronized) actions

import * as application from "./application";
import * as dialog from "./dialog";
import * as documents from "./documents";
import * as edit from "./edit";
import * as example from "./example";
import * as exportActions from "./export";
import * as groups from "./groups";
import * as guides from "./guides";
import * as help from "./help";
import * as history from "./history";
import * as keyevents from "./keyevents";
import * as layerEffects from "./layereffects";
import * as layers from "./layers";
import * as libraries from "./libraries";
import * as mask from "./mask";
import * as menu from "./menu";
import * as panel from "./panel";
import * as policy from "./policy";
import * as preferences from "./preferences";
import * as sampler from "./sampler";
import * as search from "./search";
import * as searchCommands from "./search/commands";
import * as searchDocuments from "./search/documents";
import * as searchLayers from "./search/layers";
import * as searchLibraries from "./search/libraries";
import * as shapes from "./shapes";
import * as shortcuts from "./shortcuts";
import * as superselect from "./superselect";
import * as toolEllipse from "./tool/ellipse";
import * as toolPen from "./tool/pen";
import * as toolRectangle from "./tool/rectangle";
import * as tools from "./tools";
import * as toolSampler from "./tool/sampler";
import * as toolSuperselect from "./tool/superselect";
import * as toolSuperselectType from "./tool/superselect/type";
import * as toolSuperselectVector from "./tool/superselect/vector";
import * as toolType from "./tool/type";
import * as transform from "./transform";
import * as typeActions from "./type";
import * as typetool from "./typetool";
import * as ui from "./ui";

export default {
    application: application,
    dialog: dialog,
    documents: documents,
    edit: edit,
    example: example,
    export: exportActions,
    groups: groups,
    guides: guides,
    help: help,
    history: history,
    keyevents: keyevents,
    layerEffects: layerEffects,
    layers: layers,
    libraries: libraries,
    mask: mask,
    menu: menu,
    panel: panel,
    policy: policy,
    preferences: preferences,
    sampler: sampler,
    search: search,
    searchCommands: searchCommands,
    searchDocuments: searchDocuments,
    searchLayers: searchLayers,
    searchLibraries: searchLibraries,
    shapes: shapes,
    shortcuts: shortcuts,
    superselect: superselect,
    toolEllipse: toolEllipse,
    toolPen: toolPen,
    toolRectangle: toolRectangle,
    tools: tools,
    toolSampler: toolSampler,
    toolSuperselect: toolSuperselect,
    toolSuperselectType: toolSuperselectType,
    toolSuperselectVector: toolSuperselectVector,
    toolType: toolType,
    transform: transform,
    type: typeActions,
    typetool: typetool,
    ui: ui
};
