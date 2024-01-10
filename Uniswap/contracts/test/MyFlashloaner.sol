//SPDX-License-Identifier: GPL-V3
pragma solidity ^0.8.22;

import '../interfaces/IUniswapV2Callee.sol';

import '../UniswapV2Library.sol';
import '../interfaces/IUniswapV2Router01.sol';
import '../interfaces/IERC20.sol';

import "hardhat/console.sol";


contract MyFlashloaner is IUniswapV2Callee {

    constructor() { }

    // gets tokens/WETH via a V2 flash swap, swaps for the ETH/tokens on V1, repays V2, and keeps the rest!
    function uniswapV2Call(address sender, uint amount0Out, uint amount1Out, bytes calldata data) external override {

        // For simplicity, we enforce that we are borrowing token0 in the test
        require(amount0Out > 0 && amount1Out == 0, 'MyFlashloaner: invalid amount0 or amount1!');

        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        console.log('## [ExampleFlashSwap.uniswapV2Call] token0 = ', token0, 'token1 = ', token1);
        console.log('## [ExampleFlashSwap.uniswapV2Call] sender = ', sender);

        // amounts we need to pay, consdiering 0.3% fee, amount0In * 0.997 == amount0Out
        uint fee = amount0Out * 4 / 1000;  // should be 0.301%, use 0.4% for simplicity
        uint amounts0In = amount0Out + fee;
        console.log('## [ExampleFlashSwap.uniswapV2Call] amounts0In = ', amounts0In);
        console.log('## [ExampleFlashSwap.uniswapV2Call] amounts0In = ', amounts0In);

        console.log('## [ExampleFlashSwap.uniswapV2Call] token0 balance = ', IERC20(token0).balanceOf(address(this)));
        IERC20(token0).transfer(msg.sender, amounts0In);

        // demonstrate that we can pass data to the callback function
        (uint dataUint) = abi.decode(data, (uint));
        console.log('## [ExampleFlashSwap.uniswapV2Call] dataUint = ', dataUint);
    }
}

