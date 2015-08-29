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

define(function (require, exports) {
    "use strict";

    var Promise = require("bluebird"),
        Immutable = require("immutable");

    var descriptor = require("adapter/ps/descriptor"),
        layerLib = require("adapter/lib/layer"),
        documentLib = require("adapter/lib/document"),
        generatorLib = require("adapter/lib/generator"),
        preferenceLib = require("adapter/lib/preference");

    var dialog = require("./dialog"),
        events = require("js/events"),
        locks = require("js/locks"),
        globalUtil = require("js/util/global"),
        objUtil = require("js/util/object"),
        collection = require("js/util/collection"),
        strings = require("i18n!nls/strings"),
        log = require("js/util/log"),
        global = require("js/util/global"),
        ExportAsset = require("js/models/exportasset"),
        ExportService = require("js/util/exportservice");

    /**
     * An instance of the ExportService utility used to communicate with the generator plugin
     * @private
     * @type {ExportService}
     */
    var _exportService;

    /**
     * The previous folder into which assets were saved.
     * If populated, initialize the OS folder chooser here
     * @type {?string}
     */
    var _lastFolderPath = null;

    /**
     * Fetch relevant data from both the document and export stores, and sync the metadata to
     * the photoshop "extension data".  If layerID is not supplied, then only document level 
     * metadata is synced
     *
     * Note that the underlying adapter API to setExtensionData requires the full data structure to be supplied
     * which is why we are always fetching directly from both stores prior to calling setExtensionData
     *
     * TODO maybe this should handle a set of layers, for efficiency when called by layer actions?
     *
     * @private
     * @param {number} documentID
     * @param {number=} layerID optional, if supplied, sync doc-level metadata
     * @return {Promise}
     */
    var _syncExportMetadata = function (documentID, layerID) {
        var documentExports = this.flux.stores.export.getDocumentExports(documentID),
            exportsMetadata,
            playObject;

        if (layerID || layerID === 0) {
            var layerExports = documentExports && documentExports.getLayerExports(layerID),
                layerExportsArray = layerExports && layerExports.toJS() || [],
                document = this.flux.stores.document.getDocument(documentID),
                layer = document && document.layers.byID(layerID),
                exportEnabled;

            if (!document || !layer) {
                throw new Error("Could not sync export metadata for doc:" + documentID + ", layer:" + layerID);
            }

            exportEnabled = layer.exportEnabled;

            exportsMetadata = {
                exportAssets: layerExportsArray,
                exportEnabled: exportEnabled === undefined ? false : exportEnabled
            };

            // set layer extension data
            playObject = layerLib.setExtensionData(documentID,
                layerID, global.EXTENSION_DATA_NAMESPACE, "exportsMetadata", exportsMetadata);
        } else {
            var rootExports = documentExports && documentExports.rootExports,
            rootExportsArray = rootExports && rootExports.toJS() || [];

            exportsMetadata = {
                exportAssets: rootExportsArray
            };

            // set document extension data
            playObject = documentLib.setExtensionData(documentID,
                global.EXTENSION_DATA_NAMESPACE, "exportsMetadata", exportsMetadata);
        }

        return descriptor.playObject(playObject);
    };

    /**
     * Update the status of all assets that are being requested
     * This update does not get synced to PS metadata
     *
     * @param {number} documentID
     * @param {Immutable.Iterable.<number>=} layerIDs
     * @return {Promise}
     */
    var _setAssetsRequested = function (documentID, layerIDs) {
        var payload = { documentID: documentID };

        if (layerIDs) {
            payload.layerIDs = layerIDs;
        }

        return this.dispatchAsync(events.export.SET_AS_REQUESTED, payload);
    };

    /**
     * Helper function to export a single asset using the export service, and update the metadata afterwards
     *
     * @private
     * @param {Document} document
     * @param {Layer=} layer If not supplied, this is a document-level asset
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {ExportAsset} asset asset to export
     * @return {Promise}
     */
    var _exportAsset = function (document, layer, assetIndex, asset, baseDir) {
        var fileName = (layer ? layer.name : strings.EXPORT.EXPORT_DOCUMENT_FILENAME) + asset.suffix;
        return _exportService.exportAsset(document, layer, asset, fileName, baseDir)
            .bind(this)
            .then(function (pathArray) {
                // Do we need to be aware of exports that return >1 file path?
                var assetProps = {
                    filePath: pathArray[0],
                    status: ExportAsset.STATUS.STABLE
                };
                return this.transfer(updateExportAsset, document, layer, assetIndex, assetProps);
            })
            .catch(function (e) {
                log.error("Export Failed for asset %d of layerID %d, documentID %d, with error",
                    assetIndex, layer && layer.id, document.id, e);
                var assetProps = {
                    filePath: "",
                    status: ExportAsset.STATUS.ERROR
                };
                return this.transfer(updateExportAsset, document, layer, assetIndex, assetProps);
            }) ;
    };

    /**
     * Get current status of generator
     * @private
     * @return {Promise.<boolean>}
     */
    var _getGeneratorStatus = function () {
        return descriptor.playObject(generatorLib.getGeneratorStatus())
            .then(function (status) {
                return objUtil.getPath(status, "generatorStatus.generatorStatus") === 1;
            })
            .catch(function (e) {
                log.error("Failed to determine generator status: %s", e.message);
                return false;
            });
    };

    /**
     * Enable/Disable generator based on supplied parameter
     * @private
     * @param {boolean} enabled
     * @return {Promise}
     */
    var _setGeneratorStatus = function (enabled) {
        return descriptor.playObject(generatorLib.setGeneratorStatus(enabled))
            .catch(function (e) {
                throw new Error("Could not enable generator: " + e.message);
            });
    };

    /**
     * Get the port number of the generator plugin, as stored in the photoshop custom preferences
     *
     * @return {Promise.<?string>}
     */
    var _getWebSocketPort = function () {
        var prefKey = ExportService.domainPrefKey;

        return descriptor.playObject(preferenceLib.getCustomPreference(prefKey))
            .then(function (pref) {
                var settings = JSON.parse(objUtil.getPath(pref, prefKey + ".settings") || null),
                    port = settings && settings.websocketServerPort;
                log.debug("Export: Found configured port: " + port); // TEMP
                return port;
            })
            .catch(function (e) {
                log.error("Failed to retrieve custom preference [" + prefKey + "]: " + e.message);
                return null;
            });
    };

    /**
     * Update the export store with the new service availability flag;
     *
     * @param {boolean} available
     * @return {Promise}
     */
    var _setServiceAvailable = function (available) {
        return this.dispatchAsync(events.export.SERVICE_STATUS_CHANGED, { serviceAvailable: !!available });
    };

    /**
     * Open the export modal dialog
     *
     * @return {Promise}
     */
    var openExportPanel = function () {
        return this.transfer(dialog.openDialog, "exports-panel-dialog");
    };
    openExportPanel.reads = [];
    openExportPanel.writes = [];
    openExportPanel.transfers = [dialog.openDialog];

    /**
     * Close the export modal dialog
     *
     * @return {Promise}
     */
    var closeExportPanel = function () {
        return this.transfer(dialog.closeDialog, "exports-panel-dialog");
    };
    closeExportPanel.reads = [];
    closeExportPanel.writes = [];
    closeExportPanel.transfers = [dialog.closeDialog];

    /**
     * Merge the given set of asset properties into the Export Asset model and persist in the the Ps metadata
     * If layer is not supplied, treat this as document root level asset
     *
     * @param {Document} document
     * @param {Layer=} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {object} props ExportAsset-like properties to be merged
     * @return {Promise}
     */
    var updateExportAsset = function (document, layer, assetIndex, props) {
        var documentID = document.id,
            layerID = layer && layer.id,
            assetPropsArray = [],
            payload;

        assetPropsArray[assetIndex] = props;

        payload = {
            documentID: documentID,
            layerIDs: layerID,
            assetPropsArray: assetPropsArray
        };

        return this.dispatchAsync(events.export.ASSET_CHANGED, payload)
            .bind(this)
            .then(function () {
                return _syncExportMetadata.call(this, documentID, layerID);
            });
    };
    updateExportAsset.reads = [locks.JS_DOC];
    updateExportAsset.writes = [locks.JS_EXPORT, locks.PS_DOC];

    /**
     * Set the numerical scale of the asset specified by the given index
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {number} scale
     * @return {Promise}
     */
    var updateLayerAssetScale = function (document, layer, assetIndex, scale) {
        return this.transfer(updateExportAsset, document, layer, assetIndex, { scale: scale || 1 });
    };
    updateLayerAssetScale.reads = [];
    updateLayerAssetScale.writes = [];
    updateLayerAssetScale.transfers = [updateExportAsset];

    /**
     * Set the filename suffix of the asset specified by the given index
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {string} suffix
     * @return {Promise}
     */
    var updateLayerAssetSuffix = function (document, layer, assetIndex, suffix) {
        return this.transfer(updateExportAsset, document, layer, assetIndex, { suffix: suffix });
    };
    updateLayerAssetSuffix.reads = [];
    updateLayerAssetSuffix.writes = [];
    updateLayerAssetSuffix.transfers = [updateExportAsset];

    /**
     * Set the format of the asset specified by the given index
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {string} format (example: jpg)
     * @return {Promise}
     */
    var updateLayerAssetFormat = function (document, layer, assetIndex, format) {
        return this.transfer(updateExportAsset, document, layer, assetIndex, { format: format });
    };
    updateLayerAssetFormat.reads = [];
    updateLayerAssetFormat.writes = [];
    updateLayerAssetFormat.transfers = [updateExportAsset];

    /**
     * Adds an asset with the given scale to this layer, and force layer exportEnabled if this is the first asset
     *
     * @param {Document} document
     * @param {Immutable.List.<Layer>=} layers
     * @param {number} assetIndex index of this asset within the layer's list
     * @param {number} scale
     * @return {Promise}
     */
    var addAsset = function (document, layers, assetIndex, scale) {
        var updatePromise,
            layer;

        // Currently we only support adding to the first layer,
        // but this is a way-point to a brighter future
        if (layers && layers.size > 0) {
            layer = layers.first();
        }

        // If this is the first layer-level asset, ensure that the layer is exportEnabled
        if (assetIndex === 0 && layer && !layer.exportEnabled) {
            var payload = {
                documentID: document.id,
                layerIDs: [layer.id],
                exportEnabled: true
            };
            updatePromise = this.dispatchAsync(events.document.LAYER_EXPORT_ENABLED_CHANGED, payload);
        } else {
            updatePromise = Promise.resolve();
        }

        // Since updateLayerExport handles the metadata sync, we must be sure that the layer model is updated first
        return updatePromise
            .bind(this)
            .then(function () {
                return this.transfer(updateExportAsset, document, layer, assetIndex, { scale: scale });
            });
    };
    addAsset.reads = [];
    addAsset.writes = [];
    addAsset.transfers = [updateExportAsset];

    /**
     * Delete the Export Asset configuration specified by the given index
     *
     * @param {Document} document
     * @param {Layer} layer
     * @param {number} assetIndex index of this asset within the layer's list
     * @return {Promise}
     */
    var deleteExportAsset = function (document, layer, assetIndex) {
        var documentID = document.id,
            layerID = layer ? layer.id : null,
            payload = {
                documentID: documentID,
                layerID: layerID,
                assetIndex: assetIndex
            };

        return this.dispatchAsync(events.export.DELETE_ASSET, payload)
            .bind(this)
            .then(function () {
                return _syncExportMetadata.call(this, documentID, layerID);
            });
    };
    deleteExportAsset.reads = [locks.JS_DOC];
    deleteExportAsset.writes = [locks.JS_EXPORT, locks.PS_DOC];

    /**
     * Sets the exportEnabled flag for a given layer or layers
     * @private
     * @param {Document} document Owner document
     * @param {Layer|Immutable.List.<Layer>} layers Either a Layer reference or array of Layers
     * @param {boolean=} exportEnabled
     * @return {Promise}
     */
    var setLayerExportEnabled = function (document, layers, exportEnabled) {
        var layerIDs = Immutable.List.isList(layers) ?
                collection.pluck(layers, "id").toArray() :
                [layers.id];

        var payload = {
                documentID: document.id,
                layerIDs: layerIDs,
                exportEnabled: exportEnabled
            };

        return this.dispatchAsync(events.document.LAYER_EXPORT_ENABLED_CHANGED, payload)
            .bind(this)
            .then(function () {
                return Promise.all(layerIDs.map(function (layerID) {
                    return _syncExportMetadata.call(this, document.id, layerID);
                }, this));
            });
    };
    setLayerExportEnabled.reads = [];
    setLayerExportEnabled.writes = [locks.JS_DOC, locks.PS_DOC];

    /**
     * Sets the exportEnabled flag for all artboards
     * @private
     * @param {Document} document Owner document
     * @param {boolean=} exportEnabled
     * @return {Promise}
     */
    var setAllArtboardsExportEnabled = function (document, exportEnabled) {
        var documentExports = this.flux.stores.export.getDocumentExports(document.id);

        if (!documentExports) {
            return Promise.resolve();
        }

        var layersWithExports = documentExports.getLayersWithExports(document, true);

        return this.transfer(setLayerExportEnabled, document, layersWithExports, exportEnabled);
    };
    setAllArtboardsExportEnabled.reads = [locks.JS_EXPORT];
    setAllArtboardsExportEnabled.writes = [];
    setAllArtboardsExportEnabled.transfers = [setLayerExportEnabled];

    /**
     * Sets the exportEnabled flag for all layers that have at least one configured asset
     * @private
     * @param {Document} document Owner document
     * @param {boolean=} exportEnabled
     * @return {Promise}
     */
    var setAllNonABLayersExportEnabled = function (document, exportEnabled) {
        var documentExports = this.flux.stores.export.getDocumentExports(document.id);

        if (!documentExports) {
            return Promise.resolve();
        }

        var layersWithExports = documentExports.getLayersWithExports(document, false);

        return this.transfer(setLayerExportEnabled, document, layersWithExports, exportEnabled);
    };
    setAllNonABLayersExportEnabled.reads = [locks.JS_EXPORT];
    setAllNonABLayersExportEnabled.writes = [];
    setAllNonABLayersExportEnabled.transfers = [setLayerExportEnabled];

    /**
     * Export all layer assets for the given document for which export has been enabled (layer.exportEnabled)
     * 
     * Or, if layerIDs param is supplied, export only those layers' assets
     * and disregard the layer's exportEnabled value
     *
     * @param {Document} document
     * @param {Immutable.Iterable.<number>=} layerIDs
     * @return {Promise} Resolves when all assets have been exported, or if canceled via the file chooser
     */
    var exportLayerAssets = function (document, layerIDs) {
        if (!document) {
            Promise.resolve("No Document");
        }

        if (!_exportService || !_exportService.ready()) {
            return _setServiceAvailable.call(this, false);
        }

        var documentID = document.id,
            documentExports = this.flux.stores.export.getDocumentExports(documentID),
            layerExportsMap = documentExports && documentExports.layerExportsMap;

        if (!layerExportsMap || layerExportsMap.size < 1) {
            return Promise.resolve();
        }

        // helper to perform the export after a directory has been determined
        var exportToDir = function (baseDir) {
            _lastFolderPath = baseDir;

            var layersList;
            if (layerIDs) {
                // TODO push this logic into DocumentExports model, and filter first on layerIDs
                layersList = documentExports.getLayersWithExports(document).filter(function (layer) {
                    return layerIDs.includes(layer.id);
                });
            } else {
                layersList = documentExports.getLayersWithExports(document, undefined, true);
            }

            var layerIdList = collection.pluck(layersList, "id");

            return _setAssetsRequested.call(this, document.id, layerIdList).then(function () {
                // Iterate over the layers, find the associated export assets, and export them
                var exportArray = layersList.flatMap(function (layer) {
                    return documentExports.getLayerExports(layer.id)
                        .map(function (asset, index) {
                            return _exportAsset.call(this, document, layer, index, asset, baseDir);
                        }, this);
                }, this);

                return Promise.all(exportArray.toArray());
            });
        }.bind(this);

        // prompt for folder and then export to the result.
        // resolve immediately if no folder is returned
        return _exportService.promptForFolder(_lastFolderPath || "~")
            .then(function (baseDir) {
                return baseDir ? exportToDir(baseDir) : Promise.resolve();
            });
    };
    exportLayerAssets.reads = [locks.JS_DOC, locks.JS_EXPORT];
    exportLayerAssets.writes = [locks.GENERATOR];
    exportLayerAssets.transfers = [updateExportAsset];

    /**
     * Export all document-level assets for the given document
     *
     * @param {Document} document
     * @return {Promise} resolves when all assets have been exported
     */
    var exportDocumentAssets = function (document) {
        if (!document) {
            return Promise.resolve("No Document");
        }

        var documentExports = this.flux.stores.export.getDocumentExports(document.id);

        if (!documentExports) {
            return Promise.resolve("No Document Exports");
        }

        if (!_exportService || !_exportService.ready()) {
            return _setServiceAvailable.call(this, false);
        }

        // helper to perform the export after a directory has been determined
        var exportToDir = function (baseDir) {
            return _setAssetsRequested.call(this, document.id).then(function () {
                _lastFolderPath = baseDir;

                // Iterate over the root document assets, and export them
                var exportArray = documentExports.rootExports.map(function (asset, index) {
                    return _exportAsset.call(this, document, null, index, asset, baseDir);
                }, this).toArray();

                return Promise.all(exportArray);
            });
        }.bind(this);

        // prompt for folder and then export to the result.
        // resolve immediately if no folder is returned
        return _exportService.promptForFolder(_lastFolderPath || "~").then(function (baseDir) {
            return baseDir ? exportToDir(baseDir) : Promise.resolve();
        });
    };
    exportDocumentAssets.reads = [locks.JS_DOC, locks.JS_EXPORT];
    exportDocumentAssets.writes = [locks.GENERATOR];
    exportDocumentAssets.transfers = [updateExportAsset];

    /**
     * After start up, ensure that generator is enabled, and then initialize the export service
     *
     * If in debug mode, do a pre check in case we're using a remote connection generator
     * 
     * @return {Promise}
     */
    var afterStartup = function () {
        // helper function to wait for the service init, and set the service "available" in our store
        var _initService = function () {
            return _exportService.init()
                .bind(this)
                .then(function () {
                    log.debug("Export: Generator plugin connection established");
                    return _setServiceAvailable.call(this, true);
                })
                .return(true);
        }.bind(this);

        // In debug mode we should first do an abbreviated test
        // to see if the plugin is already running (perhaps on a remote generator connection)
        var _preCheck = function () {
            if (globalUtil.debug) {
                return _getWebSocketPort()
                    .then(function (port) {
                        _exportService = new ExportService(port, true); // quickCheck mode
                        return _initService();
                    })
                    .catch(function () {
                        _exportService = null;
                        return false;
                    });
            } else {
                return Promise.resolve(false);
            }
        };

        // helper to enabled generator if necessary and then init exportService
        var _enableAndConnect = function () {
            return _getGeneratorStatus()
                .then(function (enabled) {
                    if (!enabled) {
                        log.debug("Export: Starting Generator...");
                        return _setGeneratorStatus(true);
                    }
                    return false;
                })
                .then(function (generatorJustStarted) {
                    if (generatorJustStarted) {
                        // ONLY IF we are having to force enable generator, which shouldn't be often
                        // The new port isn't configured immediately, and start up is not synchronous
                        // This is partially caused by the race in generator-core startWebsocketServer
                        return Promise.delay(3000).then(_getWebSocketPort);
                    } else {
                        return _getWebSocketPort();
                    }
                })
                .then(function (port) {
                    _exportService = new ExportService(port);
                    return _initService();
                });
        };

        return _preCheck()
            .then(function (preCheckResult) {
                return preCheckResult ||
                    _enableAndConnect().catch(function (e) {
                        log.debug("Export: failed to connect the first time (going to try one more): " + e.message);
                        _exportService = null;
                        return false;
                    });
            })
            .then(function (enabled) {
                if (!enabled) {
                    // Try one more time, in case the PORT has changed and the PS configuration lagged
                    return _enableAndConnect();
                }
            })
            .catch(function (e) {
                log.error("Export Service failed to initialize.  Giving Up.  Cause: " + e.message);
                return false;
            });
    };
    afterStartup.reads = [];
    afterStartup.writes = [locks.JS_EXPORT, locks.GENERATOR];

    /**
     * Handle the standard onReset action
     *
     * @return {Promise}
     */
    var onReset = function () {
        if (!_exportService) {
            return Promise.resolve();
        }

        return _exportService.close()
            .finally(function () {
                _exportService = null;
            });
    };
    onReset.reads = [];
    onReset.writes = [];

    exports.openExportPanel = openExportPanel;
    exports.closeExportPanel = closeExportPanel;
    exports.updateExportAsset = updateExportAsset;
    exports.updateLayerAssetScale = updateLayerAssetScale;
    exports.updateLayerAssetSuffix = updateLayerAssetSuffix;
    exports.updateLayerAssetFormat = updateLayerAssetFormat;
    exports.addAsset = addAsset;
    exports.deleteExportAsset = deleteExportAsset;
    exports.setLayerExportEnabled = setLayerExportEnabled;
    exports.setAllArtboardsExportEnabled = setAllArtboardsExportEnabled;
    exports.setAllNonABLayersExportEnabled = setAllNonABLayersExportEnabled;
    exports.exportLayerAssets = exportLayerAssets;
    exports.exportDocumentAssets = exportDocumentAssets;
    exports.afterStartup = afterStartup;
    exports.onReset = onReset;
});
