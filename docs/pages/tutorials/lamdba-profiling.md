---
title: Creating Lambdas to inspect their execution environment
keywords: lager, lambda
tags: [getting_started, tutorial, lambda]
summary: "In this tutorial, we will follow the steps to create three lambdas executing the same code, but with different configurations.
We will have a look at the execution environment of the different configurations."
sidebar: home_sidebar
permalink: lambda-profiling.html
folder: tutorials
---

Creation of three Lambdas sharing the same code
---

> The code generated by this example is available [here](https://github.com/lagerjs/lager/tree/master/demo/lambda-profiling).

Lets create a new Lager project.

```bash
lager new lambda-profiling @lager/iam @lager/lambda
```

We create a simple execution role for our Lambdas.

```bash
lager create-role LambdaInspection -m LambdaBasicExecutionRole
```

We create a node module called `inspection`. It will inspect its own execution environment.

```bash
lager create-node-module inspection
```

The `inspection` module is created in `lambda-profiling/lambda/modules/inspection` and only contain a `package.json` file for now.

Lets create an `index.js` file that exposes data from the `os` native module and the `process` global object in our module.

```javascript
// lambda-profiling/lambda/modules/inspection/index.js
'use strict';

const os = require('os');

module.exports = () => {
  return {
    host: {
      name: os.hostname(),
      architecture: process.arch,
      memory: os.totalmem(),
      cpus: os.cpus()
    },
    os: {
      platform: process.platform,
      release: os.release(),
      uptime: os.uptime()
    },
    user: {
      uid: process.getuid(),
      gid: process.getgid(),
      groups: process.getgroups
    },
    process: {
      command: process.argv,
      execArgs: process.execArgv,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    },
    exec: {
      env: process.env,
      currentDirectory: process.cwd(),
      // mainModule: process.mainModule,
      config: process.config
    }
  };
};
```

Now we create three Lambdas that will use the `inspection` module as a dependency. Their are configured with different memory values: 128MB, 512MB and 1536MB.

```bash
lager create-lambda config-128 -t 30 -m 128 --dependencies inspection -r LambdaInspection
lager create-lambda config-512 -t 30 -m 512 --dependencies inspection -r LambdaInspection
lager create-lambda config-1536 -t 30 -m 1536 --dependencies inspection -r LambdaInspection
```

We alter the handler of the three Lambdas to call the `inspection` module, log its output (it will be visible in cloudwatch) and return it.

```javascript
// lambda-profiling/lambda/lambdas/config-128/index.js
// lambda-profiling/lambda/lambdas/config-512/index.js
// lambda-profiling/lambda/lambdas/config-1536/index.js
'use strict';

const inspection = require('inspection');

module.exports.handler = function(event, context, cb) {
  const inspect = inspection();
  console.log(JSON.stringify(inspect));
  cb(null, inspect);
};
```

We can execute the lambdas locally to test them.

```bash
lager test-lambda config-128 -r us-east-1 -e DEV -s v0
```

Testing the Lambdas in AWS
---

Lets deploy in AWS!

```bash
lager deploy-lambdas config-128 config-1536 config-512 config-1536 -r us-east-1 -e DEV -s v0
```

Now we can execute the Lambdas in AWS using Lager, but you can also use the AWS console if you prefer.

```bash
lager test-lambda config-128 -r us-east-1 -e DEV -s v0
lager test-lambda config-512 -r us-east-1 -e DEV -s v0
lager test-lambda config-1536 -r us-east-1 -e DEV -s v0
```

Check the result of the functions to have insights about the execution environment of Lambdas. Observe the variations when calling several times the same
function.

>>> TODO: explain results and add a module to profile the use of require() with/without warm up of a Lambda.
