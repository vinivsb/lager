'use strict';

const path = require('path');
const Promise = require('bluebird');
const _ = require('lodash');
const icli = require('./icli');


if (process.env.NODE_ENV === 'development') {
  // Configure error reporting for dev environment
  // @TODO use bunyan for logs, including errors
  const PrettyError = require('pretty-error');
  const pe = new PrettyError();

  // To render exceptions thrown in non-promies code:
  process.on('uncaughtException', e => {
    console.log('Uncaught exception');
    console.log(pe.render(e));
  });

  // To render unhandled rejections created in BlueBird:
  process.on('unhandledRejection', r => {
    console.log('Unhandled rejection');
    console.log(pe.render(r));
  });

  Promise.config({
    warnings: true,
    longStackTraces: true,
    cancellation: true,
    monitoring: true
  });
}


icli.setProgram(require('commander'))
    .setPrompt(require('inquirer'));

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
function Lager() {
  this.plugins = [];
}

/**
 * Add a plugin to the lager instance
 * @param {Object} plugin
 * @returns {Lager}
 */
Lager.prototype.registerPlugin = function registerPlugin(plugin) {
  if (!plugin.name) { throw new Error('A lager plugin MUST have a name property'); }
  // Lager inject a getPath() method in the plugin
  plugin.getPath = function getBasePath() {
    return path.join(process.cwd(), plugin.name);
  };
  this.plugins.push(plugin);
  return this;
};

/**
 * Retrieve a plugin by name
 * @param {string} name
 * @returns {Object}
 */
Lager.prototype.getPlugin = function getPlugin(name) {
  return _.find(this.plugins, plugin => {
    return plugin.name === name;
  });
};

/**
 * Fire a hook/event
 * @param {string} eventName - the name of the hook
 * @param {...*} arg - the list of arguments provided to the hook
 * @returns {Promise<[]>} return the promise of an array containing the hook's arguments eventually transformed by plugins
 */
Lager.prototype.fire = function fire() {
  // Extract arguments and eventName
  const args = Array.prototype.slice.call(arguments);
  const eventName = args.shift();

  // let argsDescription = '(' + _.map(args, arg => {
  //   return !arg ? arg : (arg.toString ? arg.toString() : Object.prototype.toString.call(arg));
  // }).join(', ') + ')';
  // console.log('HOOK ' + eventName + argsDescription);

  // Define a recusive function that will check if a plugin implements the hook,
  // execute it and pass the eventually transformed arguments to the next one
  const callPluginsSequencialy = function callPluginsSequencialy(i, args) {
    if (!this.plugins[i]) {
      // If there is no more plugin to execute, we return a promise of the event arguments/result
      // So we are getting out of the sequencial calls
      return Promise.resolve.call(this, args);
    }

    if (this.plugins[i].hooks && this.plugins[i].hooks[eventName]) {
      // If the plugin implements the hook, then we execute it
      // console.log('call ' + eventName + ' hook from ' + this.plugins[i].name);
      return this.plugins[i].hooks[eventName].apply(this.plugins[i], args)
      .spread(function propagateArguments() {
        // We cannot use the () => {} notation here because we use `arguments`
        // When the plugin hook has been executed, we move to the next plugin (recursivity)
        return callPluginsSequencialy.bind(this)(i + 1, arguments);
      }.bind(this));
    }

    // If the plugin does not implement the hook, we move to the next plugin (recursivity)
    return callPluginsSequencialy.bind(this)(i + 1, args);
  };
  // Call the recursive function
  return callPluginsSequencialy.bind(this)(0, args);
};


const lager = new Lager();

/**
 * This property allows the lager instance to share some key dependencies with plugins
 * @type {Object}
 */
lager.import = {
  Promise, _, icli
};

module.exports = lager;
