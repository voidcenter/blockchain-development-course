import { AbiCoder } from "ethers";
import { ethers } from "hardhat";
import { UniswapV2Pair } from "../../typechain-types/UniswapV2Pair";
import { UniswapV2Factory } from "../../typechain-types/UniswapV2Factory";
import { MyERC20TokenOZ } from "../../typechain-types";
import { UniswapV2Router02 } from "../../typechain-types/UniswapV2Router02";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
const { expect } = require("chai");



// These types are all taken care of by hardhat-typechain
interface BasicTestContext {
    owner: HardhatEthersSigner;
    swapper: HardhatEthersSigner;
    token0: MyERC20TokenOZ;
    token1: MyERC20TokenOZ;
    factory: UniswapV2Factory;
    pair: UniswapV2Pair;
    router: UniswapV2Router02;
    decimals: bigint;
    // decimalsMultipler: bigint;
    // formatBigintAmount: (x: bigint) => string;
}


// Deploy all contracts needed for a basic test
async function setupBasicTestContext(owner: HardhatEthersSigner, swapper: HardhatEthersSigner): Promise<BasicTestContext> {

    // console.log('owner address = ', owner.address)
    // console.log('swapper address = ', swapper.address)
    // console.log('\n** deploy contracts **');

    // create token0 and token1
    const decimals = 18n;
    const formatBigintAmount = (x: bigint) => {
        const decimalsMultipler = 10n**decimals;
        return `${(Number(x) / Number(decimalsMultipler)).toFixed(2)}`;
    }

    const decimalsMultipler = 10n**decimals;
    const initialSupply = 10000n * decimalsMultipler;
    const token0 = await ethers.deployContract("MyERC20TokenOZ", ["Token0", "T0", decimals, initialSupply]);
    const token1 = await ethers.deployContract("MyERC20TokenOZ", ["Token1", "T1", decimals, initialSupply]);

    expect(await token0.totalSupply()).to.equal(await token0.balanceOf(owner.address));
    expect(await token1.totalSupply()).to.equal(await token1.balanceOf(owner.address));
    // console.log('token0 = ', token0.target);
    // console.log('token1 = ', token1.target);

    // create factory
    const factory = await ethers.deployContract("UniswapV2Factory", []);
    expect(await factory.allPairsLength()).to.equal(0);
    // console.log('factory = ', factory.target);

    // create pair
    // console.log(token0);
    await factory.createPair(token0.target, token1.target);        
    const pairAddress = await factory.getPair(token0.target, token1.target);
    const UniswapV2PairFactory = await ethers.getContractFactory("UniswapV2Pair");
    const pair = await UniswapV2PairFactory.attach(pairAddress) as any;
    expect(await pair.decimals()).to.equal(decimals);

    // console.log('pair = ', pairAddress);
    // console.log('pair: symbol = ', await pair.symbol(), ', token0 = ', await pair.token0(), ', token1 = ', await pair.token1(), 
    //             ', reserves = ', await pair.getReserves()); 

    // create router 
    const router = await ethers.deployContract("UniswapV2Router02", [factory.target]);

    return {
        owner,
        swapper,
        token0,
        token1,
        factory,
        pair,
        router,
        decimals,
        // decimalsMultipler,
        // formatBigintAmount
    };
}


async function basicTest(context: BasicTestContext) {

    const { owner, swapper, token0, token1, pair, router, decimals } = context;
    const decimalsMultipler = 10n**decimals;

    // add liquidity
    console.log('\n** add liquidity **');
    const time_in_the_future = Date.now() + 1000000000;
    const stakeAmount = 1000n * decimalsMultipler;
    await token0.approve(router.target, stakeAmount);
    await token1.approve(router.target, stakeAmount);
    await router.addLiquidity(token0.target, token1.target, stakeAmount, stakeAmount, 0, 0, owner.address, time_in_the_future);
    
    // check staked liquidity
    let liquidity = await pair.balanceOf(owner.address);
    let reserves = await pair.getReserves() as [bigint, bigint];
    expect(liquidity).to.be.above(0);
    expect(reserves[0]).to.equal(stakeAmount);
    expect(reserves[1]).to.equal(stakeAmount);
    console.log('liquidity added = ', liquidity); 
    console.log('pair reserves = ', reserves[0], reserves[1]); 


    // swap
    console.log('\n** swap **');
    const token0AmountIn = 100n * decimalsMultipler;
    await token0.transfer(swapper.address, token0AmountIn);   //transfer 100 token0 to swapper
    await token0.connect(swapper).approve(router.target, token0AmountIn);  // swapper allows the router to spend 100 token0
    await router.connect(swapper).swapExactTokensForTokens
        (token0AmountIn, 0, [token0.target, token1.target], swapper.address, time_in_the_future);

    // check swapped amount 
    let token1AmountOut = await token1.balanceOf(swapper.address);
    console.log('swapper swapped ', token0AmountIn, 'token0 for', token1AmountOut, 'token1');
    expect(token1AmountOut).to.be.above(0);

    // check reserves after swap
    reserves = await pair.getReserves() as [bigint, bigint];
    reserves = token0.target == (await pair.token0()) ? reserves : [reserves[1], reserves[0]];
    expect(reserves[0]).to.equal(stakeAmount + token0AmountIn);
    expect(reserves[1]).to.equal(stakeAmount - token1AmountOut);


    // remove liquidity
    console.log('\n** remove liquidity **');
    await pair.approve(router.target, liquidity);
    await router.removeLiquidity
        (token0.target, token1.target, liquidity, 0, 0, owner.address, time_in_the_future);

    // check reserves after remove liquidity
    reserves = await pair.getReserves() as [bigint, bigint];
    console.log('reserve0 = ', reserves[0], ', reserve1 = ', reserves[1]);
    console.log('reserves = ', reserves);
    expect(reserves[0]).to.be.above(0);
    expect(reserves[1]).to.be.above(0);

    console.log('pair supply = ', await pair.totalSupply());
    expect(await pair.totalSupply()).to.equal(1000n);   // permanently locked liquidity
}
