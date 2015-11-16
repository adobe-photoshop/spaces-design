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
    
    /**
     * Concatenates the json files in the locale folder   
     *
     * @param {string} locale
     * @return {Object} [description]
     */
    var i18nGetConcatOptions = function (locale) {
        return {
            dest: "src/nls/" + locale + ".json",
            src: "*.json",
            cwd: "src/nls/" + locale
        };
    };

    var gruntConfig = {
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

        clean: {
            build: ["./build"],
            i18n: ["./src/nls/*.json"]
        },
        copy: {
            requirejs: { src: "bower_components/requirejs/require.js", dest: "build/js/require.js" },
            html: { src: "src/index-build.html", dest: "build/index.html" },
            img: { expand: true, cwd: "src/img", src: "**", dest: "build/img/" }
        },
        less: {
            style: {
                files: {
                    "build/style/main.css": "src/style/main.less"
                }
            }
        },
        concurrent: {
            test: ["jshint", "jscs", "jsdoc", "jsonlint", "lintspaces"]
        }
    };

    // Auto create all i18n tasks
    
    gruntConfig["concat-json"] = {
        i18n: {
            files: ALL_LOCALES.map(function (locale) {
                return i18nGetConcatOptions(locale);
            })
        },
        options: {
            space: " "
        }
    };

    // Merge dictionaries with English for missing keys
    var jsonMergeTargets = {};

    ALL_LOCALES.forEach(function (locale) {
        if (locale === "en") {
            return;
        }

        var source = "src/nls/" + locale + ".json",
            target = "src/nls/" + locale + ".json";

        jsonMergeTargets[target] = ["src/nls/en.json", source];
    });

    gruntConfig["merge-json"] = {
        i18n: {
            files: jsonMergeTargets
        },
        options: {
            space: " "
        }
    };

    grunt.initConfig(gruntConfig);

    grunt.loadNpmTasks("grunt-jsxhint");
    grunt.loadNpmTasks("grunt-jscs");
    grunt.loadNpmTasks("grunt-jsdoc");
    grunt.loadNpmTasks("grunt-jsonlint");
    grunt.loadNpmTasks("grunt-lintspaces");

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-requirejs");
    grunt.loadNpmTasks("grunt-contrib-less");

    grunt.loadNpmTasks("grunt-concurrent");
    grunt.loadNpmTasks("grunt-concat-json");
    grunt.loadNpmTasks("grunt-merge-json");

    grunt.registerTask("seqtest", ["jshint", "jscs", "jsdoc", "jsonlint", "lintspaces"]);
    grunt.registerTask("test", ["concurrent:test"]);
    grunt.registerTask("seqcompile", ["clean", "copy:requirejs", "copy:html", "copy:img", "less", "requirejs"]);
    grunt.registerTask("compile", ["clean", "copy:requirejs", "copy:html", "copy:img", "less", "concurrent:requirejs"]);
    grunt.registerTask("compile:en", ["clean", "copy:requirejs", "copy:html", "copy:img", "less", "requirejs:en"]);
    grunt.registerTask("i18n", ["clean:i18n", "concat-json", "merge-json"]);
    grunt.registerTask("build", ["test", "compile"]);
    grunt.registerTask("default", ["test"]);
};
