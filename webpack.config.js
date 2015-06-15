module.exports = {
    entry: "./src/js/main.js",
    output: {
        path: "./build/",
        filename: "bundle.js"
    },
    module: {
        loaders: [
            {
                test: /\.js?$/,
                exclude: /(node_modules|bower_components)/,
                loader: "babel"
            },
            {
                test: /\.json?$/,
                exclude: /(node_modules|bower_components)/,
                loader: "json"
            }
        ]
    },
    resolve: {
        alias: {
            "adapter": "spaces-adapter",
            "tinycolor": "tinycolor2",
            "i18n!nls/strings": "/Users/ian/Source/playground/playground-design/src/nls/root/strings.js"
        }
    }
};
