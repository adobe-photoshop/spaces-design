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
        ReactDOM = require("react-dom"),
        Fluxxor = require("fluxxor"),
        FluxMixin = Fluxxor.FluxMixin(React),
        Immutable = require("immutable"),
        classnames = require("classnames"),
        _ = require("lodash");

    var os = require("adapter").os;

    var TitleHeader = require("js/jsx/shared/TitleHeader"),
        LayersList = require("./LayersList"),
        nls = require("js/util/nls"),
        collection = require("js/util/collection"),
        synchronization = require("js/util/synchronization");

    /**
     * Get the layer faces that correspond to the current document. Used for
     * fast, coarse invalidation.
     *
     * @private
     * @param {Document} document
     * @return {Map.<number, object>}
     */
    var _getFaces = function (document) {
        if (!document) {
            return {};
        }
        
        var faces = collection.pluck(document.layers.allVisible, "face");

        return faces.reduce(function (facesMap, face, index) {
            var layerID = face.get("id"),
                children = document.layers.nodes.get(layerID).children;
            
            facesMap[layerID] = {
                id: layerID,
                face: face,
                index: index,
                childrenCount: children ? children.size : 0,
                depth: document.layers.depth(document.layers.byID(layerID))
            };
            
            return facesMap;
        }, {});
    };

    var LayersPanel = React.createClass({
        mixins: [FluxMixin],

        /**
         * A throttled version of os.setTooltip
         *
         * @private
         * @type {?function}
         */
        _setTooltipThrottled: null,

        /**
         * The list of layers last scrolled to. Used by _scrollToSelection
         * when determining whether to scroll.
         *
         * @private
         * @type {Immutable.List.<Layer>}
         */
        _lastScrolledTo: Immutable.List(),

        /**
         * Used to suppress scrolling into view when the selection is changed
         * by clicking directly on a layer face.
         *
         * @private
         * @type {boolean}
         */
        _suppressNextScrollTo: false,

        componentWillMount: function () {
            this._setTooltipThrottled = synchronization.throttle(os.setTooltip, os, 500);
        },

        /**
         * A capture-phase click handler for the container. Used to suppress
         * scrolling into view when clicking on the layers panel directly.
         *
         * @private
         * @param {SyntheticEvent} event
         */
        _handleContainerClickCapture: function (event) {
            var containerNode = ReactDOM.findDOMNode(this.refs.container);
            if (event.target !== containerNode) {
                this._suppressNextScrollTo = true;
            }
        },

        componentDidMount: function () {
            this._scrollToSelection(this.props.document.layers);
        },

        componentDidUpdate: function () {
            this._scrollToSelection(this.props.document.layers);
        },

        shouldComponentUpdate: function (nextProps) {
            return this.props.disabled !== nextProps.disabled ||
                this.props.visible !== nextProps.visible ||
                this.props.active !== nextProps.active;
        },
        
        /**
         * Return IDs of the layers that are changed between two document models. Changes include:
         * - creation
         * - deletion
         * - update (e.g. select, expand, reorder, rename)
         *
         * @private
         * @param  {Document} document
         * @param  {Document} nextDocument
         * @return {Set.<number>}
         */
        _layerDiff: function (document, nextDocument) {
            var faces = _getFaces(document),
                nextFaces = _getFaces(nextDocument),
                changedLayerIDs = new Set();

            _.forEach(faces, function (face) {
                var nextFace = nextFaces[face.id];
                
                // layer is removed or updated
                if (!nextFace ||
                    face.index !== nextFace.index ||
                    face.depth !== nextFace.depth ||
                    face.childrenCount !== nextFace.childrenCount ||
                    !Immutable.is(face.face, nextFace.face)) {
                    changedLayerIDs.add(face.id);
                }
            });

            _.forEach(nextFaces, function (nextFace) {
                // new layer
                if (!faces[nextFace.id]) {
                    changedLayerIDs.add(nextFace.id);
                }
            });

            return changedLayerIDs;
        },
        
        /**
         * Return the paths of the given layer IDs in the layer tree. 
         * For example:
         *   given: [10]
         *   returns: [[1, 6, 8, 10]]
         *   where 1 is the root, 6 and 8 are the parents
         *
         * @private
         * @param  {Set.<number>} layerIDs
         * @return {Array.<Set.<number>>}
         */
        _getLayerPaths: function (layerIDs) {
            var result = [],
                targetIDs = new Set(layerIDs.keys());

            this.props.document.layers.roots.forEach(function (node) {
                this._getLayerPathsRecursively([], node, targetIDs, result);
            }, this);
            
            // Convert paths to zipped values for better performance in "LayerPanel#_renderLayersList".
            // From
            //   [[1,2,3], [1,4,6], [1,7]]
            // To
            //   [Set[1], Set[2,4,7], Set[3,6]]
            var zippedResult = _.zip.apply(null, result)
                    .map(function (ids) {
                        return _.reduce(ids, function (set, id) {
                            return set.add(id);
                        }, new Set());
                    });

            return zippedResult;
        },

        /**
         * Used by "LayerPanel#_getLayerPaths" for searching layer path in the tree.
         * 
         * @private
         * @param  {Array.<number>} path - the current path to the "node"
         * @param  {LayerNode} node
         * @param  {Set.<number>} targetIDs - the remaining target layer IDs
         * @param {Array.<Array<number>>} results
         */
        _getLayerPathsRecursively: function (path, node, targetIDs, results) {
            if (targetIDs.size === 0) {
                return;
            }
            
            path.push(node.id);
            
            if (targetIDs.has(node.id)) {
                results.push(_.clone(path));
                targetIDs.delete(node.id);
            }

            (node.children || []).forEach(function (childNode) {
                this._getLayerPathsRecursively(path, childNode, targetIDs, results);
            }, this);
            
            path.pop();
        },

        /**
         * Scrolls the layers panel to make (newly) selected layers visible.
         */
        _scrollToSelection: function (layerStructure) {
            // This is set when a face is clicked on initially. Suppressing the call
            // to scrollIntoViewIfNeeded below prevents a forced synchronous layout.
            if (this._suppressNextScrollTo) {
                this._suppressNextScrollTo = false;
                this._lastScrolledTo = Immutable.List();
                return;
            }

            var selected = layerStructure.selected;
            if (selected.isEmpty()) {
                return;
            }

            var previous = this._lastScrolledTo,
                next = collection.difference(selected, previous),
                visible = next.filterNot(function (layer) {
                    return layerStructure.hasCollapsedAncestor(layer);
                });

            if (visible.isEmpty()) {
                return;
            }

            var focusLayer = visible.first(),
                childNode = ReactDOM.findDOMNode(this.refs[focusLayer.key]);

            if (childNode) {
                childNode.scrollIntoViewIfNeeded();
                this._lastScrolledTo = next;
            }
        },

        /**
         * Deselects all layers.
         *
         * @private
         */
        _handleContainerClick: function () {
            this.getFlux().actions.layers.deselectAll();
        },

        /**
         * Workaround a CEF bug by clearing any active tooltips when scrolling.
         * More details here: https://github.com/adobe-photoshop/spaces-design/issues/444
         *
         * @private
         */
        _handleScroll: function () {
            this._setTooltipThrottled("");
        },

        render: function () {
            var layersListComponent = (
                <LayersList
                    isRoot={true}
                    disabled={this.props.disabled}
                    documentID={this.props.document.id}/>
            );

            var containerClasses = classnames({
                "section-container": true,
                "section-container__collapsed": !this.props.visible
            });

            var sectionClasses = classnames({
                "layers": true,
                "section": true,
                "section__active": this.props.active,
                "section__collapsed": !this.props.visible
            });

            return (
                <section
                    className={sectionClasses}
                    onScroll={this._handleScroll}>
                    <TitleHeader
                        title={nls.localize("strings.TITLE_PAGES")}
                        visible={this.props.visible}
                        disabled={this.props.disabled}
                        onDoubleClick={this.props.onVisibilityToggle}>
                    </TitleHeader>
                    <div
                        ref="container"
                        className={containerClasses}
                        onClick={this._handleContainerClick}
                        onClickCapture={this._handleContainerClickCapture}>
                        {layersListComponent}
                    </div>
                </section>
            );
        }
    });

    module.exports = LayersPanel;
});
