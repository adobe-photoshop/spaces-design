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

"use strict";

var path = require("path"),
    webpack = require("webpack"),
    ExtractTextPlugin = require("extract-text-webpack-plugin");

require("es6-promise").polyfill(); // Required for css loading

// If we call webpack with --dev, we only compile English language,
// and create sourceMaps
var devMode = process.argv.some(function (value) {
    return value === "--dev";
});

// TODO: Similar to gruntfile, find a way to make this dynamic
var languages = devMode ? ["en"] : ["en", "de", "fr", "ja"];

var buildConfigs = languages.map(function (lang) {
    var options = {
        entry: ["./src/js/init.js"],
        output: {
            path: "./build/",
            filename: "spaces-design-" + lang + ".js"
        },
        bail: true, // Abort after first error
        module: {
            loaders: [
                // Transpiling React code to js
                // TODO: Right now, js files don't get babelified correctly
                // For es6 support, we need this fixed
                {
                    test: /\.(jsx)$/,
                    exclude: /(node_modules|bower_components)/,
                    loader: "babel",
                    query: {
                        cacheDirectory: true,
                        presets: ["react"]
                    }
                },
                // JSON files are parsed and directly loaded into the bundle
                {
                    test: /\.json$/,
                    exclude: /(node_modules|bower_components)/,
                    loader: "json"
                },
                // For less files, compile them into a single css file (look below at Plugins)
                {
                    test: /\.less$/,
                    loader: ExtractTextPlugin.extract("css?sourceMap!less?sourceMap")
                },
                // SVG files get loaded to memory if they are smaller than 100 KB
                // TODO: We have a lot of svg files that are external
                // and read at run time, see if bundling them along is any better
                // using require.context
                {
                    test: /\.svg$/,
                    exclude: /(node_modules|bower_components)/,
                    loader: "url",
                    query: {
                        name: "[name].[ext]" // This keeps the file name intact
                    }
                },
                // These are in src/vendor, our file://shared files. There doesn't 
                // seem to be a good way to skip bundling these files in a way that
                // will be loadable at run time
                {
                    test: /\.otf$/,
                    loader: "url"
                }
            ]
        },
        resolve: {
            root: [
                path.join(__dirname, "src"),
                // TODO: Move us to npm at some point so we don't have any bower deps
                path.join(__dirname, "bower_components")
            ],
            alias: {
                // Until spaces-adapter is better built and points to it's main.js in it's package.json
                "adapter": path.join(__dirname, "/bower_components/spaces-adapter/src/main.js"),
                // Eventually clean all this up and use "events" that node provides to webpack
                // But that requires some code changes too (emitEvent => emit)
                "eventEmitter": path.join(__dirname, "/node_modules/wolfy87-eventemitter/EventEmitter.js"),
                // TODO: Look into externalizing React, or see if React 0.14 is plausible
                "react": path.join(__dirname, "/bower_components/react/react-with-addons.js"),
                // We alias the localization here (@/src/js/util/nls.js)
                "nls/dictionary.json": path.join(__dirname, "/src/nls/" + lang + ".json"),
                // Since there is no dynamic loading of these external files
                // they need to be copied to src/vendor
                "file://shared": path.join(__dirname, "/src/vendor"),
                // Used for explicit svg links in less files
                "src/img": path.join(__dirname, "src/img")
            },
            extensions: ["", ".js", ".jsx", ".json", ".less"]
        },
        plugins: [
            // This tells webpack to read bower.json file for finding dependencies
            new webpack.ResolverPlugin(
                new webpack.ResolverPlugin.DirectoryDescriptionFilePlugin("bower.json", ["main"])
            ),
            // This passes __PG_DEBUG__ variable to the bundle
            new webpack.DefinePlugin({
                __PG_DEBUG__: devMode
            }),
            // This extracts the styling to it's own file / sourcemap
            new ExtractTextPlugin("style.css")
        ]
    };

    if (devMode) {
        options.devtool = "source-map";
        options.debug = "true";
    }

    return options;
});

module.exports = buildConfigs;
