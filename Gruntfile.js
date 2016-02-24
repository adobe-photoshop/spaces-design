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
    
    /**
     * Given an array of locales, this sets the configuration of certain tasks
     * that rely on the list of locales
     *
     * @param {Array.<string>} locales
     */
    var setLocales = function (locales) {
        grunt.config.set(["concat-json", "i18n", "files"],
            locales.map(function (locale) {
                return {
                    dest: "build/nls/" + locale + ".json",
                    src: "*.json",
                    cwd: "src/nls/" + locale
                };
            })
        );
        grunt.config.set(["merge-json", "i18n", "files"],
            locales.reduce(function (map, locale) {
                // No need to merge English
                if (locale === "en") {
                    return map;
                }

                var source = "build/nls/" + locale + ".json",
                    target = "build/nls/" + locale + ".json";

                map[target] = ["build/nls/en.json", source];
                return map;
            }, {})
        );
        grunt.config.set(["uglify", "files"],
            locales.reduce(function (map, locale) {
                var target = "build/spaces-design-" + locale + ".js";

                map[target] = [target];
                return map;
            }, {})
        );
    };

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
                "!package.json"
            ]
        },
        jscs: {
            main: {
                src: [
                    "*.js",
                    "*.json",
                    "src/**/*.js",
                    "src/**/*.jsx"
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
                "test/**/*.json"
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
                "!src/**/*.gif"
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
            i18n: { /* Set by setLocales above */ },
            options: {
                space: " "
            }
        },
        // Merges the non-en locale dictionaries with English so any missing string
        // is replaced by the English one
        "merge-json": {
            i18n: { /* Set by setLocales above */ },
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
                    sourceMapFileInline: true,
                    outputSourceFiles: true,
                    sourceMapRootpath: "../"
                }
            }
        },
        webpack: {
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
                }
            },
            files: { /* Set by setLocales above */ }
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

    grunt.registerTask("compile",
        "Bundles Design Space in Release mode, in locale provided (all otherwise)",
        function () {
            var locales = [];
            if (this.args.length > 0) {
                locales = this.args;
            } else {
                // If not passed in, we read the nls folder for all available languages
                locales = grunt.file.expand({
                    filter: "isDirectory",
                    cwd: "src/nls"
                }, "*");
            }

            process.env.SPACES_DEV_MODE = false;
            process.env.SPACES_LOCALES = locales;
            setLocales(locales);

            grunt.config.set("webpack.options", require("./webpack.config.js"));
            
            grunt.task.run(["checkDependencies", "test", "clean:build", "i18n", "copy:img", "copy:htmlRelease",
                "less", "webpack:compile", "uglify", "clean:i18n"]);
        });

    grunt.registerTask("debug",
        "Bundles Design Space in Debug mode, for English only",
        function () {
            var locales = [];
            if (this.args.length > 0) {
                locales = this.args;
            } else {
                // In debug case, we want to default to English
                locales = ["en"];
            }

            process.env.SPACES_DEV_MODE = true;
            process.env.SPACES_LOCALES = locales;
            setLocales(locales);
            
            grunt.config.set("less.style.options.sourceMap", true);
            grunt.config.set("webpack.options", require("./webpack.config.js"));
            
            grunt.task.run(["checkDependencies", "clean", "i18n", "copy:img", "copy:htmlDebug",
                "less", "concurrent:build"]);
        });

    grunt.registerTask("default", "Runs linter tests", ["test"]);
};
