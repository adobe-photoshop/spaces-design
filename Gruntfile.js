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

/* eslint-env node */

module.exports = function (grunt) {
    "use strict";
    
    // If main task is debug, this flag gets set at the beginning
    if (grunt.cli.tasks[0] === "debug") {
        grunt.option("DEV_MODE", true);
    }

    // Matches every root folder in src/nls into a locale name
    // If we are in dev mode, compiles only English
    var DEV_MODE = grunt.option("DEV_MODE") !== undefined,
        ALL_LOCALES = DEV_MODE ? ["en"] : grunt.file.expand({
            filter: "isDirectory",
            cwd: "src/nls"
        }, "*");

    process.env.SPACES_LOCALES = ALL_LOCALES;
    process.env.SPACES_DEV_MODE = DEV_MODE;
    
    grunt.initConfig({
        eslint: {
            options: {
                configFile: ".eslintrc.json"
            },
            all: [
                "*.js",
                "*.json",
                "src/**/*.js",
                "src/**/*.jsx",
                "test/**/*.js",
                "test/**/*.jsx",
                "!npm-shrinkwrap.json",
                "!manifest.json",
                "!package.json",
                "!cc-libraries-api.min.js"
            ]
        },
        jscs: {
            main: {
                src: [
                    "*.js",
                    "*.json",
                    "src/**/*.js",
                    "src/**/*.jsx",
                    "!cc-libraries-api.min.js"
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
                "!cc-libraries-api.min.js"
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
                "!cc-libraries-api.min.js"
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
                        dest: "build/nls/" + locale + ".json",
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

                    var source = "build/nls/" + locale + ".json",
                        target = "build/nls/" + locale + ".json";

                    map[target] = ["build/nls/en.json", source];
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
            i18n: ["./build/nls"]
        },
        copy: {
            htmlRelease: { src: "src/index.html", dest: "build/index.html" },
            htmlDebug: { src: "src/index-debug.html", dest: "build/index.html" },
            img: { expand: true, cwd: "src/img", src: "**", dest: "build/img/" }
        },
        watch: {
            styles: {
                files: ["src/style/**/*"],
                tasks: ["less", "notify:less"],
                options: {
                    spawn: false,
                    interrupt: true,
                    reload: true
                }
            },
            dictionaries: {
                files: ["src/nls/**/*"],
                tasks: ["i18n"],
                options: {
                    spawn: false,
                    interrupt: true
                }
            },
            sources: {
                files: ["src/**/*"],
                options: {
                    interval: 500
                }
            },
            dependencies: {
                files: ["package.json"],
                tasks: ["checkDependencies"]
            }
        },
        // Build tasks
        less: {
            style: {
                files: {
                    "build/style.css": "src/style/main.less"
                },
                options: {
                    sourceMap: grunt.option("DEV_MODE"),
                    sourceMapFileInline: true,
                    outputSourceFiles: true,
                    sourceMapRootpath: "../"
                }
            }
        },
        webpack: {
            options: require("./webpack.config.js"),
            compile: {
                watch: false
            },
            watch: {
                watch: true,
                keepalive: true,
                failOnError: false
            }
        },
        uglify: {
            design: {
                options: {
                    compress: {
                        unused: false // This saves us about half an hour, losing 200 KB
                    },
                    define: {
                        __PG_DEBUG__: false
                    }
                },
                files: ALL_LOCALES.reduce(function (map, locale) {
                    var target = "build/spaces-design-" + locale + ".js";

                    map[target] = [target];
                    return map;
                }, {})
            }
        },
        concurrent: {
            test: ["eslint", "jscs", "jsdoc", "jsonlint", "lintspaces"],
            build: {
                tasks: ["watch:styles", "watch:dictionaries", "watch:sources", "webpack:watch", "watch:dependencies"],
                options: {
                    logConcurrentOutput: true
                }
            }
        },
        notify: {
            less: {
                options: {
                    title: "LESS",
                    message: "Build Successful"
                }
            }
        },
        checkDependencies: {
            this: {}
        }
    });

    grunt.loadNpmTasks("grunt-eslint");
    grunt.loadNpmTasks("grunt-jscs");
    grunt.loadNpmTasks("grunt-jsdoc");
    grunt.loadNpmTasks("grunt-jsonlint");
    grunt.loadNpmTasks("grunt-lintspaces");

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-less");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-watch");

    grunt.loadNpmTasks("grunt-webpack");

    grunt.loadNpmTasks("grunt-concurrent");
    grunt.loadNpmTasks("grunt-concat-json");
    grunt.loadNpmTasks("grunt-merge-json");
    grunt.loadNpmTasks("grunt-notify");
    grunt.loadNpmTasks("grunt-check-dependencies");

    grunt.registerTask("seqtest", "Runs the linter tests sequentially",
        ["eslint", "jscs", "jsdoc", "jsonlint", "lintspaces"]
    );
    grunt.registerTask("test", "Runs linter tests",
        ["checkDependencies", "concurrent:test"]
    );
    grunt.registerTask("i18n", "Prepares the localization dictionaries",
        ["clean:i18n", "concat-json", "merge-json"]
    );
    grunt.registerTask("compile", "Bundles Design Space in Release mode, for all locales",
        ["checkDependencies", "test", "clean:build", "i18n", "copy:img", "copy:htmlRelease",
         "less", "webpack:compile", "uglify", "clean:i18n"]
    );
    grunt.registerTask("debug", "Bundles Design Space in Debug mode, for English only",
        ["checkDependencies", "clean", "i18n", "copy:img", "copy:htmlDebug", "less", "concurrent:build"]
    );
    grunt.registerTask("default", "Runs linter tests", ["test"]);
};
