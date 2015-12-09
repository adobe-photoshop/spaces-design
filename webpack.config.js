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

/* jshint node: true */

"use strict";

var path = require("path"),
    webpack = require("webpack"),
    WebpackNotifierPlugin = require("webpack-notifier");

require("es6-promise").polyfill(); // Required for css loading

// In dev mode, we only compile English and build sourcemaps
var devMode = process.env.SPACES_DEV_MODE === "true",
    // If grunt didn't pass us locales, we go with only English
    locales = process.env.SPACES_LOCALES,
    languages = locales ? locales.split(",") : ["en"];

// We need grunt to build the nls and less files, so don't allow webpack by itself
if (!locales) {
    throw new Error("Please compile using `grunt compile` instead of webpack directly");
}

var buildConfigs = languages.map(function (lang) {
    var options = {
        entry: {
            app: "./src/js/init.js"
        },
        output: {
            path: "./build/",
            filename: "spaces-design-" + lang + ".js"
        },
        module: {
            loaders: [
                // Transpiling React code to js
                // TODO: Right now, js files don't get babelified correctly
                // For es6 support, we need this fixed
                {
                    test: /\.(jsx)$/,
                    exclude: /(node_modules)/,
                    loader: "babel",
                    query: {
                        cacheDirectory: true,
                        presets: ["react"]
                    }
                },
                // JSON files are parsed and directly loaded into the bundle
                {
                    test: /\.json$/,
                    exclude: /(node_modules)/,
                    loader: "json"
                },
                // SVG files get loaded to memory if they are smaller than 100 KB
                // TODO: We have a lot of svg files that are external
                // and read at run time, see if bundling them along is any better
                // using require.context
                {
                    test: /\.svg$/,
                    exclude: /(node_modules)/,
                    loader: "url",
                    query: {
                        name: "[name].[ext]" // This keeps the file name intact
                    }
                }
            ]
        },
        resolve: {
            root: [
                path.join(__dirname, "src")
            ],
            alias: {
                // Until spaces-adapter is better built and points to it's main.js in it's package.json
                "adapter": path.join(__dirname, "/node_modules/spaces-adapter/src/main.js"),
                // "scriptjs": path.join(__dirname, "/node_modules/scriptjs/dist/script.js"),
                "generator-connection": path.join(__dirname, "/node_modules/generator-connection/main.js"),
                // Eventually clean all this up and use "events" that node provides to webpack
                // But that requires some code changes too (emitEvent => emit)
                "eventEmitter": path.join(__dirname, "/node_modules/wolfy87-eventemitter/EventEmitter.js"),
                // We alias the localization here (@/src/js/util/nls.js)
                "nls/dictionary.json": path.join(__dirname, "/build/nls/" + lang + ".json")
            },
            extensions: ["", ".js", ".jsx", ".json", ".less"]
        },
        plugins: [
            // This passes __PG_DEBUG__ variable to the bundle
            new webpack.DefinePlugin({
                __PG_DEBUG__: devMode
            }),
            new WebpackNotifierPlugin({ alwaysNotify: true })
        ],
        stats: {
            hash: true // This prints out the build hash, making it easier to tell when a rebuild happens
        }
    };

    if (devMode) {
        options.devtool = "inline-source-map";
        options.debug = "true";
        // These lines break the build into two chunks, one for our code, and one for all our dependencies
        // This allows for a faster rebuild time
        options.plugins.push(new webpack.optimize.CommonsChunkPlugin("vendor", "externalDeps.js"));
        options.entry.vendor = ["react", "lodash", "bluebird", "mathjs", "immutable", "fluxxor", "d3"];
    }

    return options;
});

module.exports = buildConfigs;
