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

// If we call webpack with --watch or --dev, we only compile English language
var devMode = process.argv.some(function (value) {
    return value === "--watch" || value === "--dev";
});

// Always nice to hear from your build tools
console.log(devMode ? "Dev mode, only English will be built" : "Release mode, all locales are built");

var languages = devMode ? ["en"] : ["en", "de", "fr", "ja"];

var jsConfigs = languages.map(function (lang) {
    var options = {
        entry: ["./src/js/init.js"],
        output: {
            path: "./build/",
            filename: "spaces-design-" + lang + ".js"
        },
        bail: true,
        module: {
            loaders: [
                // Transpiling React and ES2015 code to ES5
                {
                    test: /\.(js|jsx)$/,
                    exclude: /(node_modules|bower_components)/,
                    loader: "babel",
                    query: {
                        cacheDirectory: true,
                        presets: ["react"]
                    }
                },
                // JSON files are loaded directly to memory
                {
                    test: /\.json$/,
                    exclude: /(node_modules|bower_components)/,
                    loader: "json"
                },
                // SVG files get loaded to memory if they are smaller than 100 KB
                {
                    test: /\.svg$/,
                    exclude: /(node_modules|bower_components)/,
                    loader: "url"
                }
            ]
        },
        resolve: {
            root: [
                path.join(__dirname, "src"),
                path.join(__dirname, "bower_components")
            ],
            alias: {
                // TODO: Instead of this, have spaces-adapter point to it"s bundle in
                // it"s package.json
                "adapter": "spaces-adapter/build/spaces-adapter",
                "eventEmitter": "events",
                // TODO: Look into externalizing React, or see if React 0.14 is plausible
                "react": path.join(__dirname, "/bower_components/react/react-with-addons.js"),
                // We alias the localization here
                "nls/dictionary.json": path.join(__dirname, "/src/nls/" + lang + ".json"),
                "file://shared": path.join(__dirname, "/src/vendor")
            },
            extensions: ["", ".js", ".jsx", ".json"]
        },
        plugins: [
            new webpack.ResolverPlugin(
                new webpack.ResolverPlugin.DirectoryDescriptionFilePlugin("bower.json", ["main"])
            ),
            new webpack.DefinePlugin({
                __PG_DEBUG__: devMode
            })
        ]
    };

    if (devMode) {
        options.devtool = "source-map";
        options.debug = "true";
    }

    return options;
});

var colorStops = ["original", "light", "medium", "dark"];

var lessConfigs = colorStops.map(function (stop) {
    // For the color stop, we build the loader name here and pass it to less files
    // Allowing us to build one css file for each color stop
    // TODO MAJOR: Instead of separately building these files, we should build one css file
    //              and change what we use in styles based on color stop
    //              Note: Eric is working on this on master side, using less scoped imports
    var lessOptions = {
            globalVars: {
                stop: stop
            }
        },
        lessLoaderName = "css!less?" + JSON.stringify(lessOptions);

    var options = {
        entry: ["./src/style/main.less"],
        output: {
            path: "./build/style/",
            filename: "style-" + stop + ".css"
        },
        bail: true, // Bail on first error
        module: {
            loaders: [
                // Bundle directly loaded svg files alongside with their original names
                {
                    test: /\.svg$/,
                    exclude: /(node_modules|bower_components)/,
                    loader: "file",
                    query: {
                        name: "[name].[ext]"
                    }
                },
                // Embed font files directly
                // TODO: Figure out a way to load these files at runtime from www-shared
                {
                    test: /\.otf$/,
                    loader: "url"
                },
                {
                    test: /\.(less|css)$/,
                    loader: ExtractTextPlugin.extract(lessLoaderName)
                }
            ]
        },
        resolve: {
            root: [
                path.join(__dirname, "src")
            ],
            alias: {
                // TODO: Remove this alias when we figure out runtime links
                "file://shared": path.join(__dirname, "/src/vendor"),
                // Used for explicit svg links in less files
                "src/img": path.join(__dirname, "src/img")
            },
            extensions: ["", ".less"]
        },
        plugins: [
            // This pulls out the css file from the bundle, effectively rendering it empty, so we get a valid css file
            new ExtractTextPlugin("style-" + stop + ".css", { allChunks: true })
        ]
    };

    return options;
});

var buildConfigs = jsConfigs.concat(lessConfigs);

module.exports = buildConfigs;
