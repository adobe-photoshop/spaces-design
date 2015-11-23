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
    
    /**
     * Get options for r.js parametrized by locale.
     *
     * @param {string} locale
     * @return {object}
     */
    var getRequireOptions = function (locale) {
        return {
            options: {
                baseUrl: "src/",
                mainConfigFile: "src/js/config.js",
                name: "js/init-build",
                out: "build/js/init-build-" + locale + ".js",
                // optimize: "none",
                paths: {
                    "react": "../bower_components/react/react-with-addons.min",
                    "JSXTransformer": "../bower_components/jsx-requirejs-plugin/js/JSXTransformer"
                },
                stubModules: ["jsx"],
                exclude: ["JSXTransformer"],
                useStrict: true,
                config: {
                    i18n: {
                        locale: locale
                    }
                }
            }
        };
    };

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
                "!src/vendor/**/*"
            ],
            options: {
                newline: true,
                newlineMaximum: 1
            }
        },

        clean: ["./build"],
        copy: {
            requirejs: { src: "bower_components/requirejs/require.js", dest: "build/js/require.js" },
            html: { src: "src/index-build.html", dest: "build/index.html" },
            img: { expand: true, cwd: "src/img", src: "**", dest: "build/img/" }
        },
        requirejs: {
            en: getRequireOptions("en"),
            de: getRequireOptions("de"),
            fr: getRequireOptions("fr"),
            ja: getRequireOptions("ja")
        },
        less: {
            style: {
                files: {
                    "build/style/main.css": "src/style/main.less"
                }
            }
        },
        concurrent: {
            test: ["jshint", "jscs", "jsdoc", "jsonlint", "lintspaces"],
            requirejs: ["requirejs:en", "requirejs:de", "requirejs:fr", "requirejs:ja"]
        }
    });

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

    grunt.registerTask("seqtest", ["jshint", "jscs", "jsdoc", "jsonlint", "lintspaces"]);
    grunt.registerTask("test", ["concurrent:test"]);
    grunt.registerTask("seqcompile", ["clean", "copy:requirejs", "copy:html", "copy:img", "less", "requirejs"]);
    grunt.registerTask("compile", ["clean", "copy:requirejs", "copy:html", "copy:img", "less", "concurrent:requirejs"]);
    grunt.registerTask("compile:en", ["clean", "copy:requirejs", "copy:html", "copy:img", "less", "requirejs:en"]);
    grunt.registerTask("build", ["test", "compile"]);
    grunt.registerTask("default", ["test"]);
};
