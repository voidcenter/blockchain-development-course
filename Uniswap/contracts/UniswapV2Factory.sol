//SPDX-License-Identifier: GPL-V3
pragma solidity ^0.8.22;

import './interfaces/IUniswapV2Factory.sol';
import './UniswapV2Pair.sol';


// Contract to create and index LPs 
contract UniswapV2Factory is IUniswapV2Factory {

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    constructor(address _feeToSetter) { }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS'); // single check is sufficient

        bytes memory bytecode = type(UniswapV2Pair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));

        // create contract at deterministic address: https://www.evm.codes/?fork=shanghai 
        // bytecode = [32 bytes of code length] [code]
        // add(bytecode, 32) is the starting offset for [code]
        // mload(bytecode) is [32 bytes of code length]
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        // setting token0, token1
        // it can also be designed such that they are passed to the constructor directly
        // https://ethereum.stackexchange.com/questions/78738/passing-constructor-arguments-to-the-create-assembly-instruction-in-solidity 
        IUniswapV2Pair(pair).initialize(token0, token1);

        // record in index
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}
