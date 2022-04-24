const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
module.exports = {
  mode: "development",
  devtool: 'source-map',
  entry: {
    content_script: path.resolve(__dirname, "..", "src", "content_script.ts"),
  },
  output: {
    path: path.join(__dirname, "../dist"),
    filename: "[name].js",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          transpileOnly: false,
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{from: ".", to: ".", context: "public"}]
    }),
  ],
};
