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

/*global define */

define(function (require, exports, module) {

    "use strict";

    module.exports = {
        APP_NAME: "Designshop",
        MENU: {
            APPLICATION: {
                $MENU: "Application",
                ABOUT: "About Designshop…",
                PREFERENCES: "Preferences…",
                HIDE_APPLICATION: "Hide Designshop",
                HIDE_OTHER_APPLICATIONS: "Hide Others",
                SHOW_ALL: "Show All ",
                QUIT_APPLICATION: "Quit Designshop"
            },
            FILE: {
                $MENU: "File",
                NEW: "New",
                NEW_EXTENDED: "New...",
                NEW_FROM_TEMPLATE: {
                    $MENU: "New From Template",
                    TEMPLATE_ONE: "iPhone 6",
                    TEMPLATE_TWO: "Responsive Layout"
                },
                OPEN: "Open...",
                OPEN_RECENT: {
                    $MENU: "Open Recent",
                    RECENT_ENTRY_ONE: "A recent file",
                    RECENT_ENTRY_TWO: "Another recent file",
                    RECENT_ENTRY_THREE: "Yet another recent file"
                },
                CLOSE: "Close",
                SAVE: "Save",
                SAVE_AS: "Save As…",
                REVERT: "Revert",
                RENAME_DOCUMENT: "Rename…",
                GENERATE_ASSETS: "Generate Assets…",
                AUTO_GENERATE_IMAGE_ASSETS: "Auto Generate Assets",
                PLACE_EMBEDDED: "Place Embedded…",
                PLACE_LINKED: "Place Linked…",
                PACKAGE: "Package…",
                PRINT: "Print…."
            },
            EDIT: {
                $MENU: "Edit",
                UNDO: "Undo",
                REDO: "Redo",
                CUT: "Cut",
                CUT_ATTRIBUTES: "Cut Attributes | Style",
                COPY: "Copy",
                COPY_MERGED: "Copy Merged",
                COPY_ATTRIBUTES: "Copy Attributes | Style",
                COPY_CSS: "Copy CSS Attributes",
                PASTE: "Paste",
                PASTE_ATTRIBUTES: "Paste Attributes | Style",
                DELETE: "Delete",
                CLEAR_ATTRIBUTES: "Clear Attributes",
                DUPLICATE: "Duplicate Selection",
                DUPLICATE_WITH_OFFSET: "Duplicate Selection with Offset",
                SELECT_ALL: "Select All",
                DESELECT: "Deselect",
                INVERT_SELECTION: "Invert Selection"
            },
            LAYER: {
                $MENU: "Layer",
                CONVERT_TO_SMART_OBJECT: "Convert To Smart Object",
                FIND_LAYER: "Find Layer…",
                RENAME_LAYER: "Rename Layer…",
                MERGE_LAYERS: "Merge Layers",
                COMBINE: {
                    $MENU: "Combine",
                    COMBINE_UNITE: "Unite",
                    COMBINE_SUBTRACT: "Subtract",
                    COMBINE_UNION: "Union",
                    COMBINE_DIFFERENCE: "Difference"
                },
                TRANSFORM: {
                    $MENU: "Transform",
                    TRANSFORM_SCALE: "Scale",
                    TRANSFORM_ROTATE: "Rotate",
                    TRANSFORM_ROTATE_180: "Rotate 180º",
                    TRANSFORM_ROTATE_LEFT: "Rotate Left",
                    TRANSFORM_ROTATE_RIGHT: "Rotate Right"

                },
                CREATE_CLIPPING_MASK: "Create Clipping Mask"
            },
            TYPE: {
                $MENU: "Type",
                BOLD: "Bold",
                ITALIC: "Italic",
                UNDERLINE: "Underline",
                INCREASE_FONT_SIZE: "Increase Size",
                DECREASE_FONT_SIZE: "Decrease Size",
                LOWERCASE: "Lowercase",
                UPPERCASE: "Uppercase",
                TEXT_SPACING_TIGHTEN: "Tighten Kerning | Letter Spacing",
                TEXT_SPACING_LOOSEN: "Loosen Kerning | Letter Spacing",
                LINEHEIGHT_INCREASE: "Raise Line Height",
                LINEHEIGHT_DECREASE: "Lower Line Height",
                ALIGN_TEXT: {
                    $MENU: "Align Text",
                    ALIGN_TEXT_LEFT: "Left",
                    ALIGN_TEXT_CENTER: "Center",
                    ALIGN_TEXT_RIGHT: "Right",
                    ALIGN_TEXT_JUSTIFY: "Justify"
                },
                SWASH: "Swash | …",
                OLD_STYLE: "Old Style | …",
                ORNAMENTS: "Ornaments | …",
                ORDINALS: "Ordinals | …",
                FRACTIONS: "Fractions | …",
                STANDARD_LIGATURES: "Standard Ligatures | …",
                DISCRETIONARY_LIGATURES: "Discretionary Ligatures | …",
                TITLING_ALTERNATES: "Titling Ligatures | …",
                CONTEXTUAL_ALTERNATES: "Contextual Alternates | …",
                STYLISTIC_ALTERNATES: "Stylistic Alternates | …",
                JUSTIFICATION_ALTERNATES: "Justification Alternates | …",
                CONVERT_TEXT_TO_OUTLINES: "Convert Text To Outlines"
            },
            ARRANGE: {
                $MENU: "Arrange",
                BRING_FORWARD: "Bring Forward",
                BRING_FRONT: "Bring To Front",
                SEND_BACKWARD: "Send Backward",
                SEND_TO_BACK: "Send To Back",
                DISTRIBUTE_HORIZONTAL: "Distribute Horizontally",
                DISTRIBUTE_VERTICAL: "Distribute Vertically",
                ALIGN: {
                    $MENU: "Align Objects",
                    ALIGN_LEFT: "Left",
                    ALIGN_CENTER: "Center",
                    ALIGN_RIGHT: "Right",
                    ALIGN_TOP: "Top",
                    ALIGN_MIDDLE: "Middle",
                    ALIGN_BOTTOM: "Bottom"

                },
                MAKE_GRID_OF_OBJECTS: "Make Grid of Objects…",
                FLIP_HORIZONTAL: "Flip Horizontal",
                FLIP_VERTICAL: "Flip Vertical",
                SWAP_POSITION: "Swap Position",
                GROUP_LAYERS: "Group",
                UNGROUP_LAYERS: "Ungroup",
                LOCK_LAYER: "Lock",
                UNLOCK_LAYER: "Unlock"
            },
            VIEW: {
                $MENU: "View",
                ZOOM_IN: "Zoom In",
                ZOOM_OUT: "Zoom Out",
                FIT_TO_WINDOW: "Fit To Window",
                ACTUAL_SIZE: "Actual Size",
                ZOOM_TO_SELECTION: "Zoom To Selection",
                CENTER_SELECTION: "Center Selection",
                SWITCH_TO_CLASSIC: "Switch To Photoshop",
                FULLSCREEN_MENUBAR: "Fullscreen With Menubar",
                FULLSCREEN: "Fullscreen",
                PRESENTATION: "Presentation",
                TOGGLE_EXTRAS: "Show | Hide Extras",
                TOGGLE_RULERS: "Show | Hide Rulers",
                TOGGLE_SMART_GUIDES: "Show | Hide Smart Guides",
                TOGGLE_GUIDES: "Show | Hide Guides"


            },
            WINDOW: {
                $MENU: "Window",
                MINIMIZE: "Minimize",
                BRING_ALL_TO_FRONT: "Bring All To Front",
                NEXT_DOCUMENT: "Next Document",
                PREVIOUS_DOCUMENT: "Previous Document",
                OPEN_DOCUMENT_ONE: "Document Name 1",
                OPEN_DOCUMENT_TWO: "Document Name 2",
                OPEN_DOCUMENT_THREE: "…etc…"


            },
            HELP: {
                $MENU: "Help",
                TEST: "Testing 1, 2, 3"
            }
        },
        TITLE_PAGES: "PAGES",
        TITLE_STYLE: "STYLE",
        TITLE_TRANSFORM: "TRANSFORM",
        TRANSFORM: {
            X: "X",
            Y: "Y",
            W: "W",
            H: "H",
            MIXED: "mixed"
        },
        STYLE: {
            BLEND: {
                NORMAL:"Normal",
                DISSOLVE: "Dissolve",
                DARKEN: "Darken",
                LIGHTEN: "Lighten",
                SCREEN: "Screen",
                OVERLAY: "Overlay",
                MULTIPLY: "Multiply",
                COLORBURN: "Color Burn",
                LINEARBURN: "Linear Burn",
                DARKERCOLOR: "Darker Color"
            },
            OPACITY: "Opacity",
            COMBINE: "Combine",
            FILL: {
                TITLE: "Fill",
                ALPHA: "Alpha"
            },
            STROKE: {
                TITLE: "Stroke",
                SIZE: "Size"
            },
            TYPE: {
                TITLE: "Type",
                TYPEFACE: "Typeface",
                WEIGHT: "Weight",
                SIZE: "Size",
                LETTER: "Letter",
                LINE: "Line",
                ALIGN: "Align"
            }
        }
    };
});
