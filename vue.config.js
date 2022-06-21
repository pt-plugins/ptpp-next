const path = require('path');
const packageInfo = require('./package.json');
const git = require('git-rev-sync');
const webpack = require('webpack');

const IS_PROD = ['production', 'prod'].includes(process.env.NODE_ENV);

module.exports = {
  pages: {
    options: {
      template: 'public/options.html',
      entry: './src/options/main.ts',
      title: packageInfo.archiverName,
    },
  },

  productionSourceMap: !IS_PROD, // https://cli.vuejs.org/config/#productionsourcemap
  lintOnSave: !IS_PROD, // https://cli.vuejs.org/config/#lintonsave

  // https://cli.vuejs.org/config/#pluginoptions
  pluginOptions: {
    browserExtension: {
      componentOptions: {
        background: {
          entry: 'src/background.ts',
        },
        contentScripts: {
          entries: {
            'content-script': ['src/content-scripts/content-script.ts'],
          },
        },
      },
      extensionReloaderOptions: {
        reloadPage: true, // Force the reload of the page also
      },
      manifestTransformer: (manifest) => {
        if (process.env.TARGET_BROWSER === 'firefox') {
          manifest.version = `${manifest.version}.${git.count()}`;
        } else {
          manifest.version_name = `${manifest.version}.${git.short()}`;
        }

        if (!IS_PROD) {
          manifest.description += ' (Development Mode)';
          manifest.content_security_policy = "script-src 'self' 'unsafe-eval' http://localhost:8098; object-src 'self'";
        }

        return manifest;
      },
    },
    i18n: {
      localeDir: './shared/locales', // start from './src'
      enableLegacy: false,
      compositionOnly: true,
      runtimeOnly: IS_PROD,
      fullInstall: true,
    },
  },

  configureWebpack: {
    performance: {
      hints: false,
    },
    resolve: {
      fallback: {
        buffer: require.resolve('buffer/'),
        url: false,
        path: require.resolve('path-browserify'),
        http: false,
        https: false,
        querystring: false,
      },
    },
    plugins: [
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
    ],
  },

  chainWebpack: (config) => {
    // @see https://github.com/adambullmer/vue-cli-plugin-browser-extension/issues/106
    // config.plugins.delete('provide-webextension-polyfill');
    // config.module.rules.delete('provide-webextension-polyfill');

    // @see https://github.com/intlify/vue-cli-plugin-i18n/issues/204
    config.module
      .rule('i18n-resource')
      .include.clear()
      .add(path.resolve(__dirname, './src/shared/locales'))
      .end();

    /**
     * Asset:
     * 1. add ico support for vue-cli
     * 2. change type to `asset/resource` to always generate img files
     * 3. extend filename, prefix with workspace folder
     */
    config.module
      .rule('images')
      .test(/\.(png|jpe?g|gif|webp|avif|ico)(\?.*)?$/)
      .set('type', 'asset/resource')
      .set('generator', {
        filename: (d) => {
          let packagePrefix = '';
          for (const packageElement of ['downloader', 'site']) {
            if (d.filename.includes(`packages/${packageElement}`)) {
              packagePrefix = `${packageElement}/`;
            }
          }
          return `img/${packagePrefix}[name].[hash:8][ext]`;
        }
      });
  },
};
