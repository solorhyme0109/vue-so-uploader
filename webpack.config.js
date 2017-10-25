const path = require('path')

const webpack = require('webpack')

module.exports = {
  entry: path.join(__dirname, './index.js'),
  output: {
    filename: 'uploader.js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, 'dist')
  },
  module: {
    rules: [
      { test: /\.js$/,
        use: [
          {
            loader: 'babel-loader'
          }
        ]
      },
      { test: /\.vue$/,
        use: [
          { loader: 'vue-loader' }
        ]
      }
    ]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin()
  ]
}
