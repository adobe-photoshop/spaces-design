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

/* global require */

require.config({
    baseUrl: ".",
    packages: [
        { name: "adapter", location: "../bower_components/spaces-adapter/src" },
        { name: "generator-connection", location: "../bower_components/generator-connection" }
    ],
    paths: {
        "bluebird": "../bower_components/bluebird/js/browser/bluebird",
        "eventEmitter": "../bower_components/eventEmitter/EventEmitter",
        "lodash": "../bower_components/lodash/lodash",
        "text": "../bower_components/requirejs-text/text",
        "i18n": "../bower_components/requirejs-i18n/i18n",
        "jsx": "../bower_components/jsx-requirejs-plugin/js/jsx",
        "JSXTransformer": "../bower_components/react/JSXTransformer",
        "react": "../bower_components/react/react-with-addons",
        "fluxxor": "../bower_components/fluxxor/build/fluxxor",
        "loglevel": "../bower_components/loglevel/dist/loglevel",
        "mathjs": "../bower_components/mathjs/dist/math",
        "tinycolor": "../bower_components/tinycolor/tinycolor",
        "d3": "../bower_components/d3/d3",
        "immutable": "../bower_components/immutable/dist/immutable",
        "classnames": "../bower_components/classnames/index"
    },
    jsx: {
        fileExtension: ".jsx"
    },
    waitSeconds: 0
});
