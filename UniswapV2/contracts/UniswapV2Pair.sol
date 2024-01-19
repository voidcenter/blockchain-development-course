//SPDX-License-Identifier: GPL-V3
pragma solidity ^0.8.22;

import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IERC20.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Callee.sol';
import './libraries/UniswapMath.sol';
import './UniswapV2ERC20.sol';

import "hardhat/console.sol";


// LP contract
// Owns token0, token1 balances and implicitly manages k = x * y
contract UniswapV2Pair is IUniswapV2Pair, UniswapV2ERC20 {
    using SafeMath for uint;

    uint public constant MINIMUM_LIQUIDITY = 10**3;
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    address public factory;
    address public token0;
    address public token1;

    // 112 + 112 + 32 + 256 
    uint112 private reserve0;           // uses single storage slot, accessible via getReserves
    uint112 private reserve1;           // uses single storage slot, accessible via getReserves

    // prevent reentrancy 
    uint private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, 'UniswapV2: LOCKED');
        unlocked = 0;
        _;
        unlocked = 1;
    }

    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));

        // I think this is to account for the fact that the transfer function of some tokens (like USDT)
        // deviates from the standard and doesn't return a bool.
        // White paper 3.3: https://docs.uniswap.org/whitepaper.pdf 
        // USDT: https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7#code 
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'UniswapV2: TRANSFER_FAILED');
    }

    constructor() {
        factory = msg.sender;
    }

    // called once by the factory at time of deployment
    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, 'UniswapV2: FORBIDDEN'); // sufficient check
        token0 = _token0;
        token1 = _token1;
    }

    // update reserves and, on the first call per block, price accumulators
    function _update(uint balance0, uint balance1) private {

        // uint112(-1) is uint112's the max value  
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, 'UniswapV2: OVERFLOW');

        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);

        // sync <-- this is an important event
        emit Sync(reserve0, reserve1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to) external lock returns (uint liquidity) {
        (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings

        // The sender has already send the two tokens to the pair 
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        uint amount0 = balance0.sub(_reserve0);
        uint amount1 = balance1.sub(_reserve1);

        uint _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee

        // the first staker
        if (_totalSupply == 0) {

            // See white paper 3.4: https://docs.uniswap.org/whitepaper.pdf 
            // what does the attack mean?
            liquidity = UniswapMath.sqrt(amount0.mul(amount1)).sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {

            // calculate liquidity (*) 
            // in theory, one can contribute tokens in a way that changes the ratio. In that case,
            // amount0.mul(_totalSupply) / _reserve0 and amount1.mul(_totalSupply) / _reserve1 would
            // be different. The sender can only get the lesser of the two though.
            liquidity = UniswapMath.min(amount0.mul(_totalSupply) / _reserve0, amount1.mul(_totalSupply) / _reserve1);
        }
        require(liquidity > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);

        // researve = balance 
        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);
    }

    // you can call this functthis directly or through the router
    function burn(address to) external lock returns (uint amount0, uint amount1) {
        address _token0 = token0;                                // gas savings
        address _token1 = token1;                                // gas savings

        // total balance of token0/token1 in this pair
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));

        // total liquidity being burned. should have already received it 
        uint liquidity = balanceOf[address(this)];

        // total LP token supply
        uint _totalSupply = totalSupply; 

        // calculate amount to release pro-rata (*) 
        amount0 = liquidity.mul(balance0) / _totalSupply; // using balances ensures pro-rata distribution
        amount1 = liquidity.mul(balance1) / _totalSupply; // using balances ensures pro-rata distribution
        require(amount0 > 0 && amount1 > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED');

        // burn liquidity tokens 
        _burn(address(this), liquidity);

        // release tokens 
        _safeTransfer(_token0, to, amount0);
        _safeTransfer(_token1, to, amount1);

        // update reserves 
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));
        _update(balance0, balance1);

        emit Burn(msg.sender, amount0, amount1, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external lock {
        require(amount0Out > 0 || amount1Out > 0, 'UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 _reserve0, uint112 _reserve1) = getReserves(); // gas savings

        require(amount0Out < _reserve0 && amount1Out < _reserve1, 'UniswapV2: INSUFFICIENT_LIQUIDITY');

        uint balance0;
        uint balance1;

        { // scope for _token{0,1}, avoids stack too deep errors
            address _token0 = token0;
            address _token1 = token1;
            require(to != _token0 && to != _token1, 'UniswapV2: INVALID_TO');

            // send the out amounts
            if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out); // optimistically transfer tokens
            if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out); // optimistically transfer tokens

            // call callback, this is only useful for flashloan
            if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call
                (msg.sender, amount0Out, amount1Out, data);

            // token balances after the swap
            balance0 = IERC20(_token0).balanceOf(address(this));
            balance1 = IERC20(_token1).balanceOf(address(this));
        }

        // sender needs to send in at least one token
        uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, 'UniswapV2: INSUFFICIENT_INPUT_AMOUNT');

        // check invariant, 0.3% of the amount in will be deducted as fee
        { // scope for reserve{0,1}Adjusted, avoids stack too deep errors
            uint balance0Adjusted = balance0.mul(1000).sub(amount0In.mul(3));
            uint balance1Adjusted = balance1.mul(1000).sub(amount1In.mul(3));

            // console.log('## [UniswapV2Pair.swap] balances adjusted = ', balance0Adjusted, balance1Adjusted);
            // console.log('## [UniswapV2Pair.swap] reserves = ', _reserve0, _reserve1);

            // after deducting 0.3% fee, k is constant (*)
            // k increases a little bit due to 0.3% fee.
            require(   balance0Adjusted.mul(balance1Adjusted) 
                    >= uint(_reserve0).mul(_reserve1).mul(1000**2), 
                    'UniswapV2: K');
        }

        _update(balance0, balance1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
}
