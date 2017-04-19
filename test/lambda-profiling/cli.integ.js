/*eslint-env mocha */
'use strict';

const path = require('path');
const assert = require('assert');
const Promise = require('bluebird');
const fs = require('fs-extra');
const copy = Promise.promisify(fs.copy);
const remove = Promise.promisify(fs.remove);
const icli = require('../../packages/cli/src/bin/lager');

describe('Creation and deployment of a Lambda project', () => {

  before(() => {
    process.chdir(__dirname);
  });

  beforeEach(() => {
    return icli.init();
  });

  after(() => {
    return Promise.all([
      remove(path.join(__dirname, 'node-lambda')),
      remove(path.join(__dirname, 'iam')),
      remove(path.join(__dirname, 'lager.log'))
    ]);
  });

  describe('Creation of an execution role', () => {
    it('should be done via the sub-command "create-role"', () => {
      return icli.parse('node script.js create-role LambdaInspection -p LambdaBasicExecutionRole'.split(' '))
      .then(res => {
        assert.ok(true);
      });
    });
  });

  describe('Creation of a node module', () => {
    it('should be done via the sub-command "create-node-module"', () => {
      return icli.parse('node script.js create-node-module inspection'.split(' '))
      .then(res => {
        // Create the main file of the module
        const src = path.join(__dirname, 'assets', 'inspection.js');
        const dest = path.join(__dirname, 'node-lambda', 'modules', 'inspection', 'index.js');
        return copy(src, dest);
      });
    });
  });

  describe('Creation of node Lambdas', () => {
    it('should be done via the sub-command "create-node-lambda"', () => {
      return icli.parse('node script.js create-node-lambda config-128 -t 30 -m 128 --dependencies inspection -r LambdaInspection'.split(' '))
      .then(res => {
        return icli.parse('node script.js create-node-lambda config-512 -t 30 -m 512 --dependencies inspection -r LambdaInspection'.split(' '));
      })
      .then(res => {
        return icli.parse('node script.js create-node-lambda config-1536 -t 30 -m 1536 --dependencies inspection -r LambdaInspection'.split(' '));
      })
      .then(res => {
        // Create the main file of the module
        const src = path.join(__dirname, 'assets', 'lambda.js');
        const dest128 = path.join(__dirname, 'node-lambda', 'lambdas', 'config-128', 'index.js');
        const dest512 = path.join(__dirname, 'node-lambda', 'lambdas', 'config-512', 'index.js');
        const dest1536 = path.join(__dirname, 'node-lambda', 'lambdas', 'config-1536', 'index.js');
        return Promise.all([
          copy(src, dest128),
          copy(src, dest512),
          copy(src, dest1536),
        ]);
      });
    });
  });

  describe('Local execution of node Lambdas', () => {
    it('should be done via the sub-command "test-node-lambda"', () => {
      return icli.parse('node script.js test-node-lambda config-128 -r us-east-1 -e DEV -s v0 --event test'.split(' '))
      .then(res => {
        assert.ok(true);
      });
    });
  });

  describe('Deployment of node Lambdas', () => {
    it('should be done via the sub-command "deploy-node-lambdas"', function() {
      this.timeout(30000);
      return icli.parse('node script.js deploy-node-lambdas config-128 config-1536 config-512 config-1536 -r us-east-1 -e DEV -s v0'.split(' '))
      .then(res => {
        assert.ok(true);
      });
    });
  });


  describe('Execution of node Lambdas in AWS', () => {
    it('should be done via the sub-command "test-node-lambda"', () => {
      return icli.parse('node script.js test-node-lambda config-128 -r us-east-1 -e DEV -s v0'.split(' '))
      .then(res => {
        return icli.parse('node script.js test-node-lambda config-512 -r us-east-1 -e DEV -s v0'.split(' '));
      })
      .then(res => {
        return icli.parse('node script.js test-node-lambda config-1536 -r us-east-1 -e DEV -s v0'.split(' '));
      })
      .then(res => {
        assert.ok(true);
      });
    });
  });

});