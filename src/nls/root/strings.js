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
/*jscs:disable maximumLineLength*/
/*jshint -W101*/

define(function (require, exports, module) {
    "use strict";

    module.exports = {
        ACTIONS: {
            ADD_STROKE: "Add Stroke",
            ADD_FILL: "Add Fill",
            SET_STROKE_COLOR: "Set Stroke Color",
            SET_STROKE_OPACITY: "Set Stroke Opacity",
            SET_STROKE_WIDTH: "Set Stroke Width",
            SET_STROKE_ALIGNMENT: "Set Stroke Alignment",
            SET_FILL_COLOR: "Set Fill Color",
            SET_FILL_OPACITY: "Set Fill Opacity",
            DELETE_LAYERS: "Delete Layers",
            CHANGE_LAYER_OPACITY: "Change Layer Opacity",
            SET_BLEND_MODE: "Set Blend Mode",
            FLIP_LAYERS: "Flip Layers",
            ALIGN_LAYERS: "Align Layers",
            DISTRIBUTE_LAYERS: "Distribute Layers",
            SET_RADIUS: "Set Radius",
            ROTATE_LAYERS: "Rotate Layers",
            DUPLICATE_LAYERS: "Duplicate Layers",
            SET_LAYER_EFFECTS: "Set Layer Effects",
            SET_LAYER_POSITION: "Set Position",
            SET_LAYER_SIZE: "Set Size",
            NUDGE_LAYERS: "Nudge Layers",
            SWAP_LAYERS: "Swap Layers",
            COMBINE_SHAPES: "Combine Shapes",
            SAMPLE_GRAPHICS: "Sample Graphics",
            SET_PROPORTIONAL_SCALE: "Set Proportional Scaling",
            SET_TYPE_FACE: "Set Type Face",
            SET_TYPE_COLOR: "Set Type Color",
            SET_TYPE_SIZE: "Set Type Size",
            SET_TYPE_LEADING: "Set Type Leading",
            SET_TYPE_TRACKING: "Set Type Tracking",
            SET_TYPE_ALIGNMENT: "Set Type Alignment",
            UNGROUP_LAYERS: "Ungroup layers"
        },
        APP_NAME: "Photoshop",
        FIRST_LAUNCH: {
            CONTINUE: "Continue",
            GET_STARTED: "Get Started",
            SLIDES: [
                {
                    HEADLINE: "Hiya.",
                    SUBHEAD: "Welcome to the start of something awesome.",
                    BODY_FIRST: "This is Design Space (technology preview), a companion experience to Photoshop for professional web and app designers. Interactions are tailored to your workflows, and built on the power and reliability that you know from Adobe Photoshop CC.",
                    BODY_SECOND: "This is an early look. We're still developing an end-to-end workflow but we're excited to share this Space now so that you can help shape it into the experience you want."
                },
                {
                    HEADLINE: "Streamlined Interface",
                    BODY: "A minimized toolset and a single contextual properties panel give you only the necessary information and controls, letting you focus on your work."
                },
                {
                    HEADLINE: "New Features and Interactions",
                    BODY: "We’re leveraging a new technology, Photoshop Spaces, that allows us to quickly build new interactions and features just for your workflows. Expect to get your job done faster with fewer clicks and dialogs. Stay tuned for more – this is just the beginning!",
                    FEATURE_SELECT: {
                        TITLE: "Select",
                        BODY: "An improved Select Tool simplifies targeting and editing. Double-click to dive into any group, nested group or layer, and Escape to back out."
                    },
                    FEATURE_VECTOR: {
                        TITLE: "Vector Workflow",
                        BODY: "Design Space takes a vector-first approach. Shapes and type are first-class citizens, with creation, layout, styling, and editing optimized for efficiency."
                    },
                    FEATURE_MATH: {
                        TITLE: "Math Operations",
                        BODY: "Use math operations (like 100 / 2) in any numeric field to quickly describe positions, lengths and sizes."
                    },
                    FEATURE_ARTBOARD: {
                        TITLE: "Artboard",
                        BODY: "Create multiple artboards to design both visuals and overall flow in a single document. Artboards are the default experience."
                    },
                    FEATURE_SWAP: {
                        TITLE: "Swap",
                        BODY: "Easily swap the contents and positions of any pair of layers or groups with a single click."
                    },
                    FEATURE_OS: {
                        TITLE: "Open Source",
                        BODY: "Download the source code and follow our development team’s progress on "
                    }
                },
                {
                    HEADLINE: "Moving between Design Space and Photoshop",
                    BODY: "Design Space is planned to be fully compatible with standard Photoshop and PSDs. Jump back and forth from the toolbar, with a keyboard shortcut, or from the Window menu."
                },
                {
                    HEADLINE: "Feedback",
                    BODY: "Visit us online and tell us what you think. It’s still early and you can help make Design Space even better."
                }

            ]
        },
        KEYBOARD_SHORTCUTS: {
            TOOLS_TITLE: "Tools",
            SELECT_TITLE: "Select Tool",
            TOOLS: {
                SELECT: "Select",
                RECTANGLE: "Rectangle",
                ELLIPSE: "Ellipse",
                PEN: "Pen",
                TYPE: "Type",
                SAMPLER: "Sampler",
                SEARCH: "Search",
                SEARCH_INSTRUCTION_MAC: "Cmd + F",
                SEARCH_INSTRUCTION_WIN: "Ctrl + F"
            },
            SELECT_TOOL: {
                TARGET: "Target Nested Group / Layers",
                TARGET_INSTRUCTION: "Double-click on Canvas",
                EDIT_PATH: "Edit Path / Text",
                EDIT_PATH_INSTRUCTION: "Double-click on Vector Object / Type",
                EDIT_SMART: "Edit / Open in Set Application",
                EDIT_SMART_INSTRUCTION: "Double-click on Smart Object",
                BACK_OUT: "Back Out of Hierarchy",
                BACK_OUT_INSTRUCTION: "Esc",
                HOLD_SELECTION: "Hold the Topmost Selection in Layers",
                HOLD_SEL_MAC: "Opt + Esc",
                HOLD_SEL_WIN: "Shift + Esc",
                TARGET_LAYER: "Target Specific Layer",
                TARGET_LAYER_MAC: "Cmd + Click",
                TARGET_LAYER_WIN: "Ctrl + Click"
            }
        },
        TITLE_PAGES: "Layers",
        TITLE_STYLE: "Style",
        TITLE_LIBRARIES: "Libraries",
        NO_DOC: {
            RECENT_FILES_TITLE: "Recent Files",
            ARTBOARD_PRESETS_TITLE: "Templates"
        },
        TITLE_TRANSFORM: "Transform",
        TOOLS: {
            newSelect: "V - Select Tool",
            rectangle: "R - Rectangle Tool",
            ellipse: "E - Ellipse Tool",
            pen: "P - Pen Tool",
            typeCreateOrEdit: "T - Type Tool",
            sampler: "I - Sampler Tool"
        },
        TOOLTIPS: {
            SELECT_NEXT_DOCUMENT: "Select Next Document",
            SELECT_PREVIOUS_DOCUMENT: "Select Previous Document",
            UNSUPPORTED_FEATURES: "Document has unsupported features and is read-only",
            DISTRIBUTE_HORIZONTALLY: "Distribute Horizontal Center",
            DISTRIBUTE_VERTICALLY: "Distribute Vertical Center",
            ALIGN_LEFT: "Align Left Edges",
            ALIGN_CENTER: "Align Horizontal Center",
            ALIGN_RIGHT: "Align Right Edges",
            ALIGN_TOP: "Align Top Edges",
            ALIGN_MIDDLE: "Align Vertical Center",
            ALIGN_BOTTOM: "Align Bottom Edges",
            SET_X_POSITION: "Set X Position",
            SET_Y_POSITION: "Set Y Position",
            SET_WIDTH: "Set Width",
            LOCK_PROPORTIONAL_TRANSFORM: "Lock Width & Height to Proportional",
            SET_HEIGHT: "Set Height",
            SET_ROTATION: "Set Rotation",
            FLIP_HORIZONTAL: "Flip Horizontal",
            FLIP_VERTICAL: "Flip Vertical",
            SWAP_POSITION: "Swap Position",
            SET_RADIUS: "Set Border Radius",
            SET_RADIUS_SLIDER: "Adjust Slider to Set Radius ",
            SET_OPACITY: "Set Opacity",
            VECTOR_SETTINGS: "Show Vector Settings",
            SET_COMBINATION: "Set Shape Combination",
            UNITE_SHAPE: "Unite Shape",
            SUBTRACT_SHAPE: "Subtract Shape",
            INTERSECT_SHAPE: "Intersect Shape",
            DIFFERENCE_SHAPE: "Difference Shape",
            SHOW_LOREM_IPSUM: "Show Lorem Ipsum",
            SHOW_GLYPHS: "Show Glyphs",
            TYPE_SETTINGS: "Show Type Settings",
            SET_TYPEFACE: "Set Typeface",
            SET_WEIGHT: "Set Weight",
            SET_TYPE_COLOR: "Set Text Color",
            SET_TYPE_SIZE: "Set Text Size",
            SET_LETTERSPACING: "Set Letterspacing",
            SET_LINESPACING: "Set Linespacing",
            SET_TYPE_ALIGNMENT: "Set Type Alignment",
            ALIGN_TYPE_LEFT: "Align Text Left",
            ALIGN_TYPE_CENTER: "Align Text Center",
            ALIGN_TYPE_RIGHT: "Align Text Right",
            ALIGN_TYPE_JUSTIFIED: "Justify Text",
            SET_STROKE_COLOR: "Set Stroke Color",
            SET_STROKE_OPACITY: "Set Stroke Opacity",
            SET_STROKE_SIZE: "Set Stroke Size",
            SET_STROKE_ALIGNMENT: "Set Stroke Alignment",
            TOGGLE_STROKE: "Toggle Stroke",
            SET_FILL_COLOR: "Set Fill Color",
            SET_FILL_OPACITY: "Set Fill Opacity",
            SET_FILL_BLENDING: "Set Fill Blending",
            TOGGLE_FILL: "Toggle Fill",
            SET_LAYER_VISIBILITY: "Set Layer Visibility",
            LOCK_LAYER: "Lock Layer",
            LAYER_COUNT: "Selected layers of total layers",
            TOGGLE_DROP_SHADOW: "Toggle Drop Shadow",
            DELETE_DROP_SHADOW: "Delete Drop Shadow",
            SET_DROP_SHADOW_COLOR: "Set Drop Shadow Color",
            SET_DROP_SHADOW_PROPS: "Set Drop Shadow Dimensions",
            SET_DROP_SHADOW_X_POSITION: "Set Drop Shadow X Position",
            SET_DROP_SHADOW_Y_POSITION: "Set Drop Shadow Y Position",
            SET_DROP_SHADOW_BLUR: "Set Drop Shadow Blur",
            SET_DROP_SHADOW_SPREAD: "Set Drop Shadow Spread",
            SET_COLOR_PICKER_FORMAT: "Set Color Picker Format",
            SET_COLOR_PICKER_MODE: "Set Color Picker Mode",
            TOGGLE_INNER_SHADOW: "Toggle Inner Shadow",
            DELETE_INNER_SHADOW: "Delete Inner Shadow",
            SET_INNER_SHADOW_COLOR: "Set Inner Shadow Color",
            SET_INNER_SHADOW_PROPS: "Set Inner Shadow Dimensions",
            SET_INNER_SHADOW_X_POSITION: "Set Inner Shadow X Position",
            SET_INNER_SHADOW_Y_POSITION: "Set Inner Shadow Y Position",
            SET_INNER_SHADOW_BLUR: "Set Inner Shadow Blur",
            SET_INNER_SHADOW_SPREAD: "Set Inner Shadow Spread",
            SECTION_COLLAPSE: ": double-click to collapse",
            SECTION_EXPAND: ": double-click to expand",
            GRID_MODE: "Show items as icons",
            LIST_MODE: "Show items in a list",
            ADD_GRAPHIC: "Add Graphic",
            ADD_CHARACTER_STYLE: "Add Character Style",
            ADD_LAYER_STYLE: "Add Layer Style",
            ADD_FILL_COLOR: "Add Fill Color",
            ADD_STROKE_COLOR: "Add Stroke Color",
            SEARCH_ADOBE_STOCK: "Search Adobe Stock",
            SYNC_LIBRARIES: "Sync Libraries",
            LIBRARY_SHARE: "Share",
            LIBRARY_SEND_LINK: "Send Link",
            LIBRARY_VIEW_ON_WEBSITE: "View on Website",
            LIBRARY_CLICK_TO_APPLY: "Click to apply",
            LIBRARY_DELETE: "Delete"
        },
        LAYER_KIND: {
            0: "Any Layer",
            1: "Pixel Layer",
            2: "Adjustment Layer",
            3: "Text Layer",
            4: "Vector Layer",
            5: "Smart Object Layer",
            6: "Video Layer",
            7: "Group Layer",
            8: "3D Layer",
            9: "Gradient Layer",
            10: "Pattern Layer",
            11: "Solidcolor Layer",
            12: "Background Layer",
            13: "Groupend Layer",
            ARTBOARD: "Artboard"
        },
        COLOR_PICKER: {
            FORMAT: "Format",
            MODE: {
                SOLID: "Solid",
                GRADIENT: "Gradient",
                PATTERN: "Pattern"
            }
        },
        TRANSFORM: {
            X: "X",
            Y: "Y",
            W: "W",
            H: "H",
            RADIUS: "Radius",
            ROTATE: "Rotate",
            MIXED: "mixed"
        },
        STYLE: {
            BLEND: {
                NORMAL: "Normal",
                DISSOLVE: "Dissolve",
                DARKEN: "Darken",
                LIGHTEN: "Lighten",
                SCREEN: "Screen",
                OVERLAY: "Overlay",
                MULTIPLY: "Multiply",
                COLORBURN: "Color Burn",
                LINEARBURN: "Linear Burn",
                DARKERCOLOR: "Darker Color",
                PASSTHROUGH: "Pass Through",
                COLORDODGE: "Color Dodge",
                LINEARDODGE: "Linear Dodge",
                LIGHTERCOLOR: "Lighter Color",
                SOFTLIGHT: "Soft Light",
                HARDLIGHT: "Hard Light",
                VIVIDLIGHT: "Vivid Light",
                LINEARLIGHT: "Linear Light",
                PINLIGHT: "Pin Light",
                HARDMIX: "Hard Mix",
                DIFFERENCE: "Difference",
                EXCLUSION: "Exclusion",
                SUBTRACT: "Subtract",
                DIVIDE: "Divide",
                HUE: "Hue",
                SATURATION: "Saturation",
                COLOR: "Color",
                LUMINOSITY: "Luminosity"

            },
            OPACITY: "Opacity",
            FILL: {
                TITLE: "Fill",
                ALPHA: "Alpha",
                BLENDING: "Blending"
            },
            STROKE: {
                TITLE: "Stroke",
                ALPHA: "Alpha",
                SIZE: "Size",
                ALIGNMENT: "Align",
                ALIGNMENT_MODES: {
                    INSIDE: "Inside",
                    CENTER: "Center",
                    OUTSIDE: "Outside"
                }
            },
            DROP_SHADOW: {
                TITLE: "Drop Shadows",
                ADD: "Add Drop Shadow",
                X_POSITION: "X",
                Y_POSITION: "Y",
                BLUR: "Blur",
                SPREAD: "Spread",
                MIXED: "Mixed Appearances"
            },
            INNER_SHADOW: {
                TITLE: "Inner Shadows",
                ADD: "Add Inner Shadow",
                X_POSITION: "X",
                Y_POSITION: "Y",
                BLUR: "Blur",
                SPREAD: "Spread",
                MIXED: "Mixed Appearances"
            },
            TYPE: {
                TITLE: "Type",
                TYPEFACE: "Typeface",
                WEIGHT: "Weight",
                SIZE: "Size",
                LETTER: "Letter",
                LINE: "Line",
                ALIGN: "Align",
                AUTO_LEADING: "auto",
                MISSING: "missing",
                MIXED: "mixed"
            },
            VECTOR: {
                TITLE: "Vector",
                COMBINE: "Combine"
            },
            COPY: "Copy style",
            PASTE: "Paste style"
        },
        TEMPLATES: {
            IPHONE_6_PLUS: "iPhone 6+",
            IPHONE_6: "iPhone 6",
            IPHONE_5: "iPhone 5",
            IPAD_12: "iPad Mini",
            IPAD_34: "iPad Retina",
            ANDROID_1080P: "Android 1080p",
            MS_SURFACE_PRO_3: "Microsoft Surface Pro 3",
            APPLE_WATCH_38MM: "Apple Watch 38mm",
            APPLE_WATCH_42MM: "Apple Watch 42mm",
            WEB_1440_900: "Web",
            WEB_1920_1080: "Web"
        },
        SEARCH: {
            PLACEHOLDER: "Search, open & select",
            PLACEHOLDER_FILTER: "Search ",
            NO_OPTIONS: "No results match your search",
            HEADERS: {
                ALL_LAYER: "Layers",
                CURRENT_LAYER: "Layers",
                CURRENT_DOC: "Current Documents",
                RECENT_DOC: "Recent Documents",
                MENU_COMMAND: "Menu Commands",
                LIBRARY: "All Libraries",
                FILTER: "Limit search to..."
            },
            CATEGORIES: {
                CURRENT_DOC: "Current Documents",
                RECENT_DOC: "Recent Documents",
                MENU_COMMAND: "Menu Commands",
                ALL_LAYER: "Layers",
                CURRENT_LAYER: "Layers",
                ARTBOARD: "Artboards",
                PIXEL: "Pixel Layers",
                ADJUSTMENT: "Adjustment Layers",
                TEXT: "Text Layers",
                VECTOR: "Vector Layers",
                SMARTOBJECT: "Smart Objects",
                GROUP: "Group Layers",
                LIBRARY: "All Libraries",
                GRAPHIC: "Graphics",
                LAYERSTYLE: "Layer Styles",
                CHARACTERSTYLE: "Character Styles"
            },
            MODIFIERS: {
                COMMAND: "Cmd",
                SHIFT: "Shift",
                ALT: "Alt",
                CONTROL: "Ctrl"
            }
        },
        KEYCODE: {
            8: "Backspace",
            9: "Tab",
            13: "Enter",
            27: "Escape",
            33: "Page Up",
            34: "Page Down",
            35: "End",
            36: "Home",
            37: "Left Arrow",
            38: "Up Arrow",
            39: "Right Arrow",
            40: "Down Arrow",
            45: "Insert",
            46: "Delete",
            91: "Windows",
            92: "Windows",
            93: "Windows Menu",
            112: "F1",
            113: "F2",
            114: "F3",
            115: "F4",
            116: "F5",
            117: "F6",
            118: "F7",
            119: "F8",
            120: "F9",
            121: "F10",
            122: "F11",
            123: "F12"
        },
        LIBRARIES: {
            CREATE_LIBRARY: "Create New Library",
            RENAME_LIBRARY: "Rename \"%s\"",
            DELETE_LIBRARY: "Delete \"%s\"",
            DELETE_LIBRARY_SHARED_CONFIRM: "Your collaborators will no longer have access to this library if you delete it. Are you sure you want to delete \"%s\"?",
            LEAVE_LIBRARY: "Leave \"%s\"",
            LEAVE_LIBRARY_CONFIRM: "Are you sure you want to leave \"%s\"?",
            DELETE_ASSET: "Delete \"%s\"",
            DELETE_ASSET_CONFIRM: "Are you sure you want to delete \"%s\"?",
            GRAPHICS: "Graphics",
            COLORS: "Colors",
            COLOR_THEMES: "Color Themes",
            CHAR_STYLES: "Text Styles",
            LAYER_STYLES: "Layer Styles",
            BRUSHES: "Brushes",
            BRUSHES_UNSUPPORTED_1: "You have 1 brush. Brushes are not supported in Design Space.",
            BRUSHES_UNSUPPORTED_N: "You have %s brushes. Brushes are not supported in Design Space.",
            BTN_CANCEL: "Cancel",
            BTN_SAVE: "Save",
            BTN_RENAME: "Rename",
            BTN_DELETE: "Delete",
            CLICK_TO_APPLY: "Click to apply",
            LIBRARY_NAME: "Library Name",
            INTRO_TITLE: "Your Content. Anywhere.",
            INTRO_BODY: "Use Libraries to organize, access, and share your assets across desktop and mobile.",
            INTRO_LINK_TITLE: "Learn how to use Libraries",
            INTRO_URL: "https://helpx.adobe.com/creative-cloud/help/libraries.html",
            NO_CONNECTION: "To use Creative Cloud Libraries, please sign in to Creative Cloud."
        },
        ERR: {
            UNRECOVERABLE: "Design Space has encountered an unrecoverable error."
        }
    };
});
