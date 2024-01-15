//SPDX-License-Identifier: GPL-V3
pragma solidity ^0.8.22;

import '../interfaces/IUniswapV2Callee.sol';

import '../UniswapV2Library.sol';
import '../interfaces/IUniswapV2Router01.sol';
import '../interfaces/IERC20.sol';

import "hardhat/console.sol";


contract FlashloanTest is IUniswapV2Callee {

    constructor() { }

    // Take out a collateral-less loan and repay it back with fee
    // Usually, amount0Out == 0 or amount1Out == 0, but it's not required
    function uniswapV2Call(address sender, uint amount0Out, uint amount1Out, bytes calldata data) 
            external override {

        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        console.log('## [ExampleFlashSwap.uniswapV2Call] token0 = ', token0, 'token1 = ', token1);
        console.log('## [ExampleFlashSwap.uniswapV2Call] sender = ', sender);

        console.log('## [ExampleFlashSwap.uniswapV2Call] amounts0Out = ', amount0Out);
        console.log('## [ExampleFlashSwap.uniswapV2Call] amounts1Out = ', amount1Out);

        // amounts we need to pay, consdiering 0.3% fee, amount0In * 0.997 == amount0Out
        // uint fee = amount0Out * 4 / 1000;  // should be 0.301%, use 0.4% for simplicity

        // amount0In * 0.997 = amount0Out
        uint amount0In = amount0Out > 0 ? amount0Out * 1000 / 997 + 1 : 0;
        uint amount1In = amount1Out > 0 ? amount1Out * 1000 / 997 + 1 : 0;

        // uint amount0In = amount0Out + amount0Out * 4 / 1000;
        // uint amount1In = amount1Out + amount1Out * 4 / 1000;
        console.log('## [ExampleFlashSwap.uniswapV2Call] amounts0In = ', amount0In);
        console.log('## [ExampleFlashSwap.uniswapV2Call] amounts1In = ', amount1In);

        console.log('## [ExampleFlashSwap.uniswapV2Call] token0 balance = ', IERC20(token0).balanceOf(address(this)));
        console.log('## [ExampleFlashSwap.uniswapV2Call] token1 balance = ', IERC20(token1).balanceOf(address(this)));

        if (amount0In > 0) {
            IERC20(token0).transfer(msg.sender, amount0In);
        }
        if (amount1In > 0) {
            IERC20(token1).transfer(msg.sender, amount1In);
        }

        // demonstrate that we can pass data to the callback function
        (uint dataUint) = abi.decode(data, (uint));
        console.log('## [ExampleFlashSwap.uniswapV2Call] dataUint = ', dataUint);
    }
}
