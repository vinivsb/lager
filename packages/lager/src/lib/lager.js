'use strict';

const path = require('path');
const Promise = require('bluebird');
const _ = require('lodash');
const Pebo = require('pebo');
Pebo.setPromise(Promise);
const log = require('./log');

if (['dev', 'development', 'debug'].indexOf(process.env.NODE_ENV) > -1) {
  Promise.config({
    longStackTraces: true
  });

  process.on('uncaughtException', (e) => {
    log.fatal(e, 'Uncaught Exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.fatal({promise: promise, reason: reason}, 'Unhandled Rejection');
    process.exit(1);
  });
}


/**
 * Lager singleton definition
 *
 * The instance will register plugins and emit events
 * It is an Pebo event emitter
 */
class Lager extends Pebo {

  /**
   * Construct the lager instance
   *
   * The lager instance is a singleton that can explore the application configuration
   * give information about it, control it's validity and perform deployment
   *
   * It is possible to register plugins on the lager instance
   * A lager plugin can implements hooks to inject code and modify the behavior of
   * the lager instance
   * A lager plugin can create his own hooks for the lager instance, so it is possible
   * to create plugins for a lager plugin!
   * @constructor
   */
  constructor() {
    super();
    this.log = log;
    this.config = [];
    this.plugins = [];
    this.extensions = [];
    const originalFire = this.fire;

    // Overide Pebo.fire() to log calls
    this.fire = function() {
      const nbListeners = this.events[arguments[0]] ? this.eventslength : 0;
      this.log.trace('Event ' + arguments[0] + ' has been fired for ' + nbListeners + ' listeners');
      return originalFire.apply(this, arguments);
    }.bind(this);
  }

  /**
   * Add a plugin to the lager instance
   * @param {Object} plugin
   * @returns {Lager}
   */
  registerPlugin(plugin) {
    // We inject the Lager instnce into the plugin
    plugin.lager = this;

    // We retrieve the configuration defined in the project for this plugin
    // The norm in Lager is to write configuration object keys in camelCase
    const plugiConfigKey = _.camelCase(plugin.name);
    const pluginConfig = this.getConfig(plugiConfigKey);
    if (pluginConfig !== undefined) {
      // We override the default configuration of the plugin with th one of the project
      plugin.config = _.assign(plugin.config, pluginConfig);
    }
    // We reference the "final" plugin configuration in the Lager configuration
    this.config[plugiConfigKey] = plugin.config;

    // We "register" the plugin in the Lager instance
    this.plugins.push(plugin);

    // Add hooks/event listeners
    plugin.hooks = plugin.hooks || [];
    _.map(plugin.hooks, (fn, event) => {
      this.when(event, fn);
    });

    // Add extensions: functions that extends the Lager instance
    plugin.extensions = plugin.extensions || [];
    _.map(plugin.extensions, (fn, extensionName) => {
      this.extensions[plugin.name + ':' + extensionName] = fn;
    });

    return this;
  }

  /**
   * Check if a plugin is registered
   * @param {string} name
   * @returns {boolean}
   */
  isPluginRegistered(name) {
    return _.findIndex(this.plugins, plugin => { return plugin.name === name;}) !== -1;
  }

  /**
   * Retrieve a plugin by name
   * @param {string} name
   * @returns {Object}
   */
  getPlugin(name) {
    const plugin = _.find(this.plugins, plugin => {
      return plugin.name === name;
    });
    if (!plugin) {
      throw new Error('The plugin "' + name + '" is not registered in the Lager instance');
    }
    return plugin;
  }

  /**
   * Call an extension
   * In case the extension has not been added to the Lager instance,
   * A Promise of the last argument will be returned
   * @return {Promise}
   */
  call() {
    // Extract arguments and extension name
    const args = Array.prototype.slice.call(arguments);
    const name = args.shift();
    if (this.extensions[name]) {
      return this.extensions[name].apply(null, args);
    }
    return Promise.resolve(args[args.length - 1]);
  }

  /**
   * Initialisation of the Lager instance
   * It looks for a configuration file and register plugins
   * @return {Promise} - a promise that resolves when the initialisation is finished
   */
  init(config) {
    // Set configuration from lager.json
    this.config = config.config;

    config.plugins = config.plugins || [];

    _.forEach(config.plugins, pluginIdentifier => {
      let requireArg = pluginIdentifier;
      try {
        // Try to load plugins installed in node_modules
        require.resolve(requireArg);
      } catch (e) {
        try {
          // Try to load project specific plugins
          requireArg = path.join(process.cwd(), pluginIdentifier);
          require.resolve(requireArg);
        } catch (e) {
          try {
            // Hack to use symbolink link to the repo for integration tests
            requireArg = path.join(process.cwd(), 'node_modules', pluginIdentifier);
            require.resolve(requireArg);
          } catch (e) {
            requireArg = false;
            lager.log.warn('Lager could not find the plugin "' + pluginIdentifier + '"');
          }
        }
      }
      if (requireArg) {
        lager.registerPlugin(require(requireArg), pluginIdentifier);
      }
    });

    return this.fire('afterInit');
  }

  getConfig(key) {
    if (key === undefined) {
      return this.config;
    }

    // If the key has the form "my.config.key"
    // We look for a value in this.config.my.config.key
    const configParts = key.split('.');
    let part = this.config[configParts.shift()];
    while (configParts.length > 0) {
      if (part === undefined) {
        // If the nested structure does not exist, we return undefined immediately
        return undefined;
      }
      part = part[configParts.shift()];
    }
    return part;
  }
}

const lager = new Lager();

module.exports = lager;
