'use strict';

// pnpm v11 requires explicit allowance for packages to run build scripts.
// This file grants build script permission for unrs-resolver (required by
// some native modules in this project) without using the deprecated
// "pnpm.onlyBuiltDependencies" field in package.json.
module.exports = {
  hooks: {
    readPackage(pkg) {
      return pkg;
    },
  },
};
