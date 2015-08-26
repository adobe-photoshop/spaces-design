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

define(function (require, exports, module) {
    "use strict";

    var React = require("react"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        Immutable = require("immutable");

    var strings = require("i18n!nls/strings"),
        pathUtil = require("js/util/path"),
        TitleHeader = require("jsx!js/jsx/shared/TitleHeader");

    /**
     * Maximum number of recent files to display
     *
     * @const {Number}
     */
    var MAX_RECENT_FILES = 10;

    var RecentFiles = React.createClass({
        mixins: [FluxMixin],
        propTypes: {
            recentFiles: React.PropTypes.instanceOf(Immutable.Iterable).isRequired
        },

        /**
         * given a file path, open the document
         *
         * @param {string} filePath
         * @param {SyntheticEvent} event
         */
        _openFile: function (filePath, event) {
            this.getFlux().actions.documents.open(filePath);
            event.stopPropagation();
        },

        render: function () {
            var recentFilesLimited = this.props.recentFiles.slice(0, MAX_RECENT_FILES),
                shortenedPaths = pathUtil.getShortestUniquePaths(recentFilesLimited),
                recentFilelinks = shortenedPaths.map(function (shortPath, index) {
                    var filePath = this.props.recentFiles.get(index);
                    return (
                        <li
                            key={index}
                            className="link-list__item overflow-ellipsis"
                            onClick={this._openFile.bind(this, filePath)}>
                            {shortPath}
                        </li>
                    );
                }, this);

            return (
                <section className="recent-files section">
                    <TitleHeader title={strings.NO_DOC.RECENT_FILES_TITLE} />
                    <div className="section-container">
                        <ul className="link-list__list">
                            {recentFilelinks}
                        </ul>
                    </div>
                </section>
            );
        }
    });

    module.exports = RecentFiles;
});
