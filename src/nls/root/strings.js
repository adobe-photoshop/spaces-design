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
        MENU: {
            APPLICATION: {
                $MENU: "Application",
                ABOUT_MAC: "About Photoshop…",
                PREFERENCES: "Preferences…",
                HIDE_APPLICATION: "Hide Photoshop",
                HIDE_OTHER_APPLICATIONS: "Hide Others",
                SHOW_ALL: "Show All",
                QUIT_APPLICATION_MAC: "Quit Photoshop"
            },
            FILE: {
                $MENU: "File",
                NEW: "New",
                NEW_EXTENDED: "New…",
                NEW_FROM_TEMPLATE: {
                    $MENU: "New From Template",
                    IPHONE_6_PLUS: "iPhone 6+",
                    IPHONE_6: "iPhone 6",
                    IPHONE_5: "iPhone 5",
                    IPAD_12: "iPad Mini",
                    IPAD_34: "iPad Retina",
                    ANDROID_1080P: "Android 1080p",
                    MS_SURFACE_PRO: "Microsoft Surface Pro",
                    MS_SURFACE_PRO_3: "Microsoft Surface Pro 3",
                    APPLE_WATCH_38MM: "Apple Watch 38mm",
                    APPLE_WATCH_42MM: "Apple Watch 42mm",
                    WEB_1440_900: "Web (1440 x 900)",
                    WEB_1920_1080: "Web (1920 x 1080)"
                },
                OPEN: "Open...",
                OPEN_RECENT: {
                    $MENU: "Open Recent"
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
                PRINT: "Print…",
                QUIT_APPLICATION_WIN: "Quit Photoshop"
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
                SEARCH: "Search",
                COMBINE: {
                    $MENU: "Combine",
                    COMBINE_UNION: "Union",
                    COMBINE_SUBTRACT: "Subtract",
                    COMBINE_INTERSECT: "Intersect",
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
                CREATE_CLIPPING_MASK: "Create Clipping Mask",
                CREATE_ARTBOARD: "Create New Artboard"
            },
            TYPE: {
                $MENU: "Type",
                ADD_FONTS_FROM_TYPEKIT: "Add Fonts from Typekit…",
                BOLD: "Bold",
                ITALIC: "Italic",
                UNDERLINE: "Underline",
                CHANGE_CASE: {
                    $MENU: "Change Case",
                    LOWERCASE: "lowercase",
                    UPPERCASE: "UPPERCASE",
                    TITLECASE: "Title Case",
                    SENTENCECASE: "Sentence case"
                },
                INCREASE_FONT_SIZE: "Increase Size",
                DECREASE_FONT_SIZE: "Decrease Size",
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
                CONVERT_TEXT_TO_OUTLINES: "Convert Text to Outlines"
            },
            ARRANGE: {
                $MENU: "Arrange",
                BRING_FORWARD: "Bring Forward",
                BRING_FRONT: "Bring to Front",
                SEND_BACKWARD: "Send Backward",
                SEND_TO_BACK: "Send to Back",
                LAYOUT_MAKE_GRID_OF_OBJECTS: "Make Grid of Objects…",
                LAYOUT_DIVIDE: "Divide…",
                LAYOUT_INSET: "Inset…",
                DISTRIBUTE: {
                    $MENU: "Distribute Objects",
                    DISTRIBUTE_HORIZONTAL: "Horizontally",
                    DISTRIBUTE_VERTICAL: "Vertically",
                    DISTRIBUTE_EVENLY: "Evenly"
                },
                ALIGN: {
                    $MENU: "Align Objects",
                    ALIGN_LEFT: "Left",
                    ALIGN_CENTER: "Center",
                    ALIGN_RIGHT: "Right",
                    ALIGN_TOP: "Top",
                    ALIGN_MIDDLE: "Middle",
                    ALIGN_BOTTOM: "Bottom"

                },
                FLIP_HORIZONTAL: "Flip Horizontal",
                FLIP_VERTICAL: "Flip Vertical",
                SWAP_POSITION: "Swap Position",
                LOCK_LAYER: "Lock",
                UNLOCK_LAYER: "Unlock",
                GROUP_LAYERS: "Group",
                UNGROUP_LAYERS: "Ungroup"
            },
            VIEW: {
                $MENU: "View",
                ZOOM_IN: "Zoom In",
                ZOOM_OUT: "Zoom Out",
                FIT_TO_WINDOW: "Fit to Window",
                ACTUAL_SIZE: "Actual Size",
                ZOOM_TO_SELECTION: "Zoom to Selection",
                CENTER_SELECTION: "Center Selection",
                FULLSCREEN_MENUBAR: "Full Screen with Menu Bar",
                FULLSCREEN: "Full Screen",
                PRESENTATION: "Presentation",
                TOGGLE_EXTRAS: "Show | Hide Extras",
                TOGGLE_RULERS: "Show | Hide Rulers",
                TOGGLE_SMART_GUIDES: "Show Smart Guides",
                TOGGLE_GUIDES: "Show Guides"
            },
            WINDOW: {
                $MENU: "Window",
                MINIMIZE: "Minimize",
                BRING_ALL_TO_FRONT: "Bring All to Front",
                NEXT_DOCUMENT: "Next Document",
                TOGGLE_TOOLBAR: "Pin Toolbar",
                PREVIOUS_DOCUMENT: "Previous Document",
                RETURN_TO_STANDARD: "Return to Standard Photoshop",
                OPEN_DOCUMENT_ONE: "Document Name 1",
                OPEN_DOCUMENT_TWO: "Document Name 2",
                OPEN_DOCUMENT_THREE: "…etc…"
            },
            HELP: {
                $MENU: "Help",
                ABOUT_WIN: "About Photoshop…",
                RUN_TESTS: "Run Tests…",
                ACTION_FAILURE: "Test Action Failure…",
                RESET_FAILURE: "Test Reset Failure…",
                CORRUPT_MODEL: "Test Model Corruption…",
                UPDATE_CURRENT_DOCUMENT: "Update Current Document",
                RESET_RECESS: "Reset Design Space",
                OPEN_FIRST_LAUNCH: "Design Space Introduction",
                SHORTCUTS: "Keyboard Shortcuts",
                TWITTER: "Design Space on Twitter",
                HELPX: "Design Space Help",
                FORUM: "Design Space Forum"
            }
        },
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
                TYPE: "Type"
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
        TITLE_PAGES: "LAYERS",
        TITLE_STYLE: "STYLE",
        TITLE_LIBRARIES: "LIBRARIES",
        NO_DOC: {
            RECENT_FILES_TITLE: "RECENT FILES",
            ARTBOARD_PRESETS_TITLE: "TEMPLATES"
        },
        TITLE_TRANSFORM: "TRANSFORM",
        TOOLS: {
            newSelect: "V - Select Tool",
            rectangle: "R - Rectangle Tool",
            ellipse: "E - Ellipse Tool",
            pen: "P - Pen Tool",
            typeCreateOrEdit: "T - Type Tool",
            eyedropper: "I - Sampler Tool"
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
            SET_DROP_SHADOW_COLOR: "Set Drop Shadow Color",
            SET_DROP_SHADOW_PROPS: "Set Drop Shadow Dimensions",
            SET_DROP_SHADOW_X_POSITION: "Set Drop Shadow X Position",
            SET_DROP_SHADOW_Y_POSITION: "Set Drop Shadow Y Position",
            SET_DROP_SHADOW_BLUR: "Set Drop Shadow Blur",
            SET_DROP_SHADOW_SPREAD: "Set Drop Shadow Spread",
            SET_COLOR_PICKER_FORMAT: "Set Color Picker Format",
            SET_COLOR_PICKER_MODE: "Set Color Picker Mode",
            TOGGLE_INNER_SHADOW: "Toggle Inner Shadow",
            SET_INNER_SHADOW_COLOR: "Set Inner Shadow Color",
            SET_INNER_SHADOW_PROPS: "Set Inner Shadow Dimensions",
            SET_INNER_SHADOW_X_POSITION: "Set Inner Shadow X Position",
            SET_INNER_SHADOW_Y_POSITION: "Set Inner Shadow Y Position",
            SET_INNER_SHADOW_BLUR: "Set Inner Shadow Blur",
            SET_INNER_SHADOW_SPREAD: "Set Inner Shadow Spread",
            SECTION_COLLAPSE: ": double-click to collapse",
            SECTION_EXPAND: ": double-click to expand",
            GRID_MODE: "Show items as icons",
            LIST_MODE: "Show items in a list"
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
            13: "Groupend Layer"
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
                SPREAD: "Spread"
            },
            INNER_SHADOW: {
                TITLE: "Inner Shadows",
                ADD: "Add Inner Shadow",
                X_POSITION: "X",
                Y_POSITION: "Y",
                BLUR: "Blur",
                SPREAD: "Spread"
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
                MISSING: "missing"
            },
            VECTOR: {
                TITLE: "Vector",
                COMBINE: "Combine"
            }
        },
        TEMPLATES: {
            IPHONE_6_PLUS: "iPhone 6+",
            IPHONE_6: "iPhone 6",
            IPHONE_5: "iPhone 5",
            IPAD_12: "iPad Mini",
            IPAD_34: "iPad Retina",
            ANDROID_1080P: "Android 1080p",
            MS_SURFACE_PRO: "Microsoft Surface Pro",
            MS_SURFACE_PRO_3: "Microsoft Surface Pro 3",
            APPLE_WATCH_38MM: "Apple Watch 38mm",
            APPLE_WATCH_42MM: "Apple Watch 42mm",
            WEB_1440_900: "Web",
            WEB_1920_1080: "Web"
        },
        ERR: {
            UNRECOVERABLE: "Design Space has encountered an unrecoverable error."
        }
    };
});
