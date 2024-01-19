//SPDX-License-Identifier: GPL-V3
pragma solidity ^0.8.22;

import '../interfaces/IUniswapV2Callee.sol';

import '../UniswapV2Library.sol';
import '../interfaces/IUniswapV2Router02.sol';
import '../interfaces/IERC20.sol';

import "hardhat/console.sol";


// This contract is a test contract for arbitrage
// For simplicity, only triangle arbitrage is supported.
// The arbitrage path is passed in via the data field of the flash swap.
contract ArbitrageTest is IUniswapV2Callee {
    address factory;
    address router;

    constructor(address _factory, address _router) { 
        factory = _factory;
        router = _router;
    }

    function uniswapV2Call(address sender, uint amount0Out, uint amount1Out, bytes calldata data) external override {

        require(amount0Out > 0 || amount1Out > 0, 'MyFlashloaner: amount0Out and amount1Out are both zero!');
        require(amount0Out * amount1Out == 0, 'MyFlashloaner: amount0Out and amount1Out are both nonzero!');
        uint amountOut = amount0Out + amount1Out;

        // parse the arbitrage path
        (address[] memory parsedData) = abi.decode(data, (address[]));
        console.log('## [ExampleFlashSwap.uniswapV2Call] data length = ', parsedData.length);
        for (uint i=0; i<parsedData.length; i++) {
            console.log('## [ExampleFlashSwap.uniswapV2Call] parsedData[] = ', i, parsedData[i]);
        }   

        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        console.log('## [ExampleFlashSwap.uniswapV2Call] token0 = ', token0, 'token1 = ', token1);
        require(parsedData[0] == token0 || parsedData[0] == token1, 'ArbitrageTest: invalid token0!');
        require(IERC20(parsedData[0]).balanceOf(address(this)) >= amountOut, 'ArbitrageTest: insufficient balance!');

        // arbitrage
        uint startAmount = amountOut;  // the amount we borrowed out of the pool is the amount we put into the trade
        IERC20(parsedData[0]).approve(router, startAmount);
        IUniswapV2Router02(router).swapExactTokensForTokens(startAmount, 0, parsedData, address(this), block.timestamp + 60);

        // pay back the flash loan
        uint paybackAmount = amountOut * 1000 / 997 + 1;  
        console.log('## [ExampleFlashSwap.uniswapV2Call] paybackAmount = ', paybackAmount);
        IERC20(parsedData[0]).transfer(msg.sender, paybackAmount);  // pay back the flash loan
        console.log('## [ExampleFlashSwap.uniswapV2Call] profit = ', IERC20(parsedData[0]).balanceOf(address(this)));
    }
}
