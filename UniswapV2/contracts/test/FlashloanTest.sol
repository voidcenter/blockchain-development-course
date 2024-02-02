//SPDX-License-Identifier: GPL-V3
pragma solidity ^0.8.22;

import '../interfaces/IUniswapV2Callee.sol';

import '../UniswapV2Library.sol';
import '../interfaces/IUniswapV2Router01.sol';
import '../interfaces/IERC20.sol';

import "hardhat/console.sol";


contract TestContract is IUniswapV2Callee {
    constructor() { }

    function uniswapV2Call(address sender, uint amount0Out, uint amount1Out, 
                           bytes calldata data) 
            external override {

        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();

        if (amount0Out > 0) {
            IERC20(token0).transfer(msg.sender, amount0Out);
        }
        if (amount1Out > 0) {
            IERC20(token1).transfer(msg.sender, amount1Out);
        }
    }
}

