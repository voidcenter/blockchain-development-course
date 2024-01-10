//SPDX-License-Identifier: GPL-V3
pragma solidity ^0.8.22;

import './interfaces/IERC20.sol';
import './interfaces/IUniswapV2ERC20.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Router02.sol';

import './libraries/SafeMath.sol';
import './libraries/TransferHelper.sol';

import './UniswapV2Library.sol';

import "hardhat/console.sol";


// Routing txns to the appropriate LP
// Handle some of the token transfers and math
// Ultimately, the LP enforces the invariants.
contract UniswapV2Router02 is IUniswapV2Router02 {
    using SafeMath for uint;

    address public immutable override factory;

    // Make sure we are not executing functions with an overly long delay 
    //   (caused by network congestion, los gas fee, etc.)
    // Trading is highly time sensitive. If they user submitted an order
    // at 1pm and got stuck due to traffic, they don't want to find out in 
    // surprise 3 hours later that the order executed hours later at 
    // a drastically different price. If the order is stuck due to traffic, 
    // it won't happen.
    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'UniswapV2Router: EXPIRED');
        _;
    }

    constructor(address _factory) {
        factory = _factory;
    }

    // **** ADD LIQUIDITY ****

    // The sender specifies the desired amount of tokens to contribute (more like max)
    // and the minimal contribution 
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal virtual returns (uint amountA, uint amountB) {

        // console.log('1');

        // create the pair if it doesn't exist yet
        if (IUniswapV2Factory(factory).getPair(tokenA, tokenB) == address(0)) {
            // you can also call this function directly to create the pair, the func is external 
            IUniswapV2Factory(factory).createPair(tokenA, tokenB);
        }

        // console.log('2');
        // Get the pair's current token reserves
        (uint reserveA, uint reserveB) = UniswapV2Library.getReserves(factory, tokenA, tokenB);

        // console.log('3', reserveA, reserveB);


        // determine how much the sender needs to contribute. such contribution should not 
        // change the ratio between the two tokens 
        if (reserveA == 0 && reserveB == 0) {

            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {

            // if the sender contributes amountADesired tokenA, how much tokenB should be contributed? 
            uint amountBOptimal = UniswapV2Library.quote(amountADesired, reserveA, reserveB);

            // if the tokenB amount falls into the sender's specified range, anchroing on amountADesired
            if (amountBOptimal <= amountBDesired) {

                // more like "amountBMin too high", not really insufficient amount 
                require(amountBOptimal >= amountBMin, 'UniswapV2Router: INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);

            //  if the tokenA amount falls into the sender's specified range, anchroing on amountBDesired
            } else {
                uint amountAOptimal = UniswapV2Library.quote(amountBDesired, reserveB, reserveA);

                // Given the above, we know that    amountADesired * reserveB / reserveA > amountBDesired
                // rearrange we get    amountBDesired * reserveA / reserveB < amountADesired
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'UniswapV2Router: INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {

        // console.log('## [UniswapV2Router02.addLiquidity] tokenA = ', tokenA);

        // get amount 
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);

        // console.log('## [UniswapV2Router02.addLiquidity] 2', amountA, amountB);


        address pair = UniswapV2Library.pairFor(factory, tokenA, tokenB);

        // get the tokens 
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);

        // mint the LP token to the sender
        liquidity = IUniswapV2Pair(pair).mint(to);
    }


    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountA, uint amountB) {
        address pair = UniswapV2Library.pairFor(factory, tokenA, tokenB);

        // console.log('## [UniswapV2Router02.removeLiquidity] liquidty = ', liquidity, 'pair = ', pair);

        // burn those LP tokens from the sender 
        IUniswapV2ERC20(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        (uint amount0, uint amount1) = IUniswapV2Pair(pair).burn(to);

        (address token0,) = UniswapV2Library.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, 'UniswapV2Router: INSUFFICIENT_A_AMOUNT');
        require(amountB >= amountBMin, 'UniswapV2Router: INSUFFICIENT_B_AMOUNT');
    }


    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint[] memory amounts, address[] memory path, address _to) internal virtual {
        for (uint i; i < path.length - 1; i++) {

            // prepare the two amounrs 
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = UniswapV2Library.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));

            // for the last swap, send the out token to the sender
            // otherwise, send the out token to the LP so that it can perform the next swap
            address to = i < path.length - 2 ? UniswapV2Library.pairFor(factory, output, path[i + 2]) : _to;

            // perform swap
            IUniswapV2Pair(UniswapV2Library.pairFor(factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }

    // Specify the in token amount, get out tokens (with a min bound)
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {

        // get path amounts
        amounts = UniswapV2Library.getAmountsOut(factory, amountIn, path);

        // fail if the out token amount is below the min
        require(amounts[amounts.length - 1] >= amountOutMin, 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');

        // send the initiail in token
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, UniswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        );

        // swap
        _swap(amounts, path, to);
    }

    // specify the out token amount and get it, with an in token amount boundßß
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {

        // get path amounts 
        amounts = UniswapV2Library.getAmountsIn(factory, amountOut, path);

        // fail if the in token amount if above the max
        require(amounts[0] <= amountInMax, 'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');

        // send the initiail in token
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, UniswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        );

        // swap
        _swap(amounts, path, to);
    }

    // **** LIBRARY FUNCTIONS ****

    // these are written this way probably for the flexibility of overriding

    function quote(uint amountA, uint reserveA, uint reserveB) public pure virtual override returns (uint amountB) {
        return UniswapV2Library.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut)
        public
        pure
        virtual
        override
        returns (uint amountOut)
    {
        return UniswapV2Library.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut)
        public
        pure
        virtual
        override
        returns (uint amountIn)
    {
        return UniswapV2Library.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOut(uint amountIn, address[] memory path)
        public
        view
        virtual
        override
        returns (uint[] memory amounts)
    {
        return UniswapV2Library.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(uint amountOut, address[] memory path)
        public
        view
        virtual
        override
        returns (uint[] memory amounts)
    {
        return UniswapV2Library.getAmountsIn(factory, amountOut, path);
    }
}

