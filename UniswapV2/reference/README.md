This is a stripped down version of https://github.com/Uniswap/v2-core and https://github.com/Uniswap/v2-periphery. This version is set up to teach the core concepts in Uniswap v2. It differes from the original version in that: 

* Some non-critical files are commented out in their entirety. (UniswapV2Migrator.sol, etc.)
* Some non-critical fields and functions are commented out. (Fee-related functions in UniswapV2Pair.sol, etc.)
* Comments are added to the code.

As of 01/2024, v2-periphery compiles and passes all the tests on the latest node (v20). v2-core requires the following setup to pass all the tests. Install [`nvm`](https://github.com/nvm-sh/nvm).

```
nvm install lts/erbium
nvm use lts/erbium
```

Reference: https://github.com/Uniswap/v2-core/issues/194 

