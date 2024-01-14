//SPDX-License-Identifier: GPL-V3
pragma solidity ^0.8.22;

// whoever borrows flashloan needs to implement this
interface IUniswapV2Callee {
    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external;
}
