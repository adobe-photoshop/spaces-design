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

/* jshint browser: false, node: true */

module.exports = function (grunt) {
    "use strict";
    
    // Matches every root folder in src/nls into a locale name
    var ALL_LOCALES = grunt.file.expand({
            filter: "isDirectory",
            cwd: "src/nls"
        }, "*");
    
    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: true
            },
            all: [
                "*.js",
                "*.json",
                "src/**/*.js",
                "src/**/*.jsx",
                "test/**/*.js",
                "test/**/*.jsx",
                "!src/vendor/**/*"
            ]
        },
        jscs: {
            main: {
                src: [
                    "*.js",
                    "*.json",
                    "src/**/*.js",
                    "src/**/*.jsx",
                    "!src/vendor/**/*"
                ],
                options: {
                    config: ".jscsrc"
                }
            },
            secondary: {
                src: [
                    "test/**/*.js",
                    "test/**/*.jsx"
                ],
                options: {
                    config: ".jscsrc",
                    jsDoc: false
                }
            }
        },
        jsdoc: {
            dist: {
                src: ["src"],
                options: {
                    destination: "docs/jsdoc",
                    recurse: true
                }
            }
        },
        jsonlint: {
            src: [
                "*.json",
                "src/**/*.json",
                "test/**/*.json",
                "!src/vendor/**/*"
            ]
        },
        lintspaces: {
            src: [
                "*",
                "src/**/*.json",
                "src/**/*.jsx",
                "src/**/*.js",
                "src/**/*.svg",
                "src/**/*.less",
                "!src/**/*.gif",
                "!src/vendor/**/*",
                "!src/nls/*.json"
            ],
            options: {
                newline: true,
                newlineMaximum: 1
            }
        },
        // Preparation tasks
        // Concatenates the multiple dictionary files
        // into a single json file per locale
        "concat-json": {
            i18n: {
                files: ALL_LOCALES.map(function (locale) {
                    return {
                        dest: "src/nls/" + locale + ".json",
                        src: "*.json",
                        cwd: "src/nls/" + locale
                    };
                })
            },
            options: {
                space: " "
            }
        },
        // Merges the non-en locale dictionaries with English so any missing string
        // is replaced by the English one
        "merge-json": {
            i18n: {
                files: ALL_LOCALES.reduce(function (map, locale) {
                    // No need to merge English
                    if (locale === "en") {
                        return map;
                    }

                    var source = "src/nls/" + locale + ".json",
                        target = "src/nls/" + locale + ".json";

                    map[target] = ["src/nls/en.json", source];
                    return map;
                }, {})
            },
            options: {
                space: " "
            }
        },
        // Utility tasks
        clean: {
            build: ["./build"],
            i18n: ["./src/nls/*.json"]
        },
        copy: {
            html: { src: "src/index.html", dest: "build/index.html" },
            img: { expand: true, cwd: "src/img", src: "**", dest: "build/img/" }
        },
        // Build tasks
        less: {
            style: {
                files: {
                    "build/style.css": "src/style/main.less"
                },
                options: {
                    sourceMap: !!grunt.option("dev"),
                    sourceMapFilename: "build/style.css.map", // Put it in build
                    sourceMapURL: "style.css.map" // But point to it in the same folder
                }
            }
        },
        webpack: {
            design: require("./webpack.config.js"),
            options: {
                watch: !!grunt.option("watch"),
                keepalive: !!grunt.option("watch")
            }
        },
        concurrent: {
            test: ["jshint", "jscs", "jsdoc", "jsonlint", "lintspaces"]
        }
    });

    grunt.loadNpmTasks("grunt-jsxhint");
    grunt.loadNpmTasks("grunt-jscs");
    grunt.loadNpmTasks("grunt-jsdoc");
    grunt.loadNpmTasks("grunt-jsonlint");
    grunt.loadNpmTasks("grunt-lintspaces");

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-less");

    grunt.loadNpmTasks("grunt-webpack");

    grunt.loadNpmTasks("grunt-concurrent");
    grunt.loadNpmTasks("grunt-concat-json");
    grunt.loadNpmTasks("grunt-merge-json");

    grunt.registerTask("seqtest", ["jshint", "jscs", "jsdoc", "jsonlint", "lintspaces"]);
    grunt.registerTask("test", ["concurrent:test"]);
    grunt.registerTask("i18n", ["clean:i18n", "concat-json", "merge-json"]);
    grunt.registerTask("compile", ["test", "clean:build", "i18n", "copy", "less", "webpack", "clean:i18n"]);
    grunt.registerTask("default", ["test"]);
};
