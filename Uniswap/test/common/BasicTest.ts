const { expect } = require("chai");
import { ethers } from "hardhat";
import { AbiCoder } from "ethers";
import * as fs from 'fs';

import { UniswapV2Pair } from "../../typechain-types/UniswapV2Pair";
import { UniswapV2Factory } from "../../typechain-types/UniswapV2Factory";
import { MyERC20TokenOZ } from "../../typechain-types";
import { UniswapV2Router02 } from "../../typechain-types/UniswapV2Router02";
import { DECIMALS, DECIMALS_MULTIPLIER, TEST_TOKEN_INITIAL_SUPPLY, getPairContract, getPairContractFromAddress, waitForDeployTxs, waitForTxs } from "./common";
import { getBigIntAmountFormater, tx, deployTx } from "./common";
import { Signers, verifyContract } from "./common";
import { FlashloanTest } from "../../typechain-types/contracts/test/FlashloanTest.sol";


// These types are all taken care of by hardhat-typechain
export interface BasicTestContracts {
    tokenA: MyERC20TokenOZ;
    tokenB: MyERC20TokenOZ;
    factory: UniswapV2Factory;
    pair: UniswapV2Pair;
    router: UniswapV2Router02;
    flashloaner: FlashloanTest;
}


// Deploy all contracts needed for a basic test
// This can sometimes take up to 1.5 ETH
export async function deployBasicTestContracts(signers: Signers, localTest: boolean = false): Promise<BasicTestContracts> {

    const { owner, swapper } = signers;
    console.log('\n');
    let deployTxs;
    let txs;

    // deploy token0, token1, factory
    deployTxs = [];
    console.log('Deploying tokenA contract...');    
    deployTxs.push(await ethers.deployContract("MyERC20TokenOZ", ["TokenA", "TA", DECIMALS, TEST_TOKEN_INITIAL_SUPPLY]));

    console.log('Deploying tokenB contract...');    
    deployTxs.push(await ethers.deployContract("MyERC20TokenOZ", ["TokenB", "TB", DECIMALS, TEST_TOKEN_INITIAL_SUPPLY]));

    console.log('Deploying factory contract...');    
    deployTxs.push(await ethers.deployContract("UniswapV2Factory", []));

    const [tokenA, tokenB, factory] = await waitForDeployTxs(deployTxs) as [MyERC20TokenOZ, MyERC20TokenOZ, UniswapV2Factory];

    // console.log('token0 = ', token0.target);
    // console.log('token1 = ', token1.target);
    // console.log('factory = ', factory.target);

    // Deploy router and flashloaner, create pair
    console.log('Deploying router contract ...');    
    deployTxs = [];
    deployTxs.push(await ethers.deployContract("UniswapV2Router02", [factory.target]));

    console.log('Deploying FlashloanTest contract...');
    deployTxs.push(await ethers.deployContract("FlashloanTest", []));

    console.log('Creating pair for tokenA and tokenB ...');    
    txs = [];
    txs.push(await factory.createPair(tokenA.target, tokenB.target));

    const [router, flashloaner] = await waitForDeployTxs(deployTxs) as [UniswapV2Router02, FlashloanTest];
    await waitForTxs(txs);

    const pair = await getPairContract(factory, tokenA.target, tokenB.target);

    // console.log('router = ', router.target);
    // console.log('flashloaner = ', flashloaner.target);
    // console.log('pair = ', pair.target);

    // Approve the router to transfer tokens from owner and swapper
    // This is to simplify test. In practice, you should not do this because it is not safe.
    console.log('Approving the router to transfer tokenA, tokenB and liquidity token from owner ...')
    console.log('Approving the router to transfer tokenA from swapper ...')
    await waitForTxs([
        await tokenA.approve(router.target, TEST_TOKEN_INITIAL_SUPPLY),
        await tokenB.approve(router.target, TEST_TOKEN_INITIAL_SUPPLY),
        await pair.approve(router.target, TEST_TOKEN_INITIAL_SUPPLY),
        await tokenA.connect(swapper).approve(router.target, TEST_TOKEN_INITIAL_SUPPLY),
    ]);
    

    if (localTest) {    
        expect(await tokenA.totalSupply()).to.equal(await tokenA.balanceOf(owner.address));
        expect(await tokenB.totalSupply()).to.equal(await tokenB.balanceOf(owner.address));
        expect(await factory.allPairsLength()).to.equal(1);
        expect(await pair.decimals()).to.equal(DECIMALS);
        expect(await router.factory()).to.equal(factory.target);
    }

    return {
        tokenA,
        tokenB,
        factory,
        pair,
        router,
        flashloaner,
    };
}


export function printBasicTestContracts(contracts: BasicTestContracts) {
    const { tokenA, tokenB, factory, pair, router, flashloaner } = contracts;
    console.log('\n** context **');
    console.log('tokenA = ', tokenA.target);
    console.log('tokenB = ', tokenB.target);
    console.log('factory = ', factory.target);
    console.log('pair = ', pair.target);
    console.log('router = ', router.target);
    console.log('flashloaner = ', flashloaner.target);
}


export async function verifyBasicTestContracts(contracts: BasicTestContracts) {
    const { tokenA, tokenB, factory, pair, router, flashloaner } = contracts;
    console.log('Verifying contracts ...');
    await verifyContract(tokenA.target, `"TokenA" "TA" ${DECIMALS.toString()} ${TEST_TOKEN_INITIAL_SUPPLY.toString()}`);
    await verifyContract(tokenB.target, `"TokenB" "TB" ${DECIMALS.toString()} ${TEST_TOKEN_INITIAL_SUPPLY.toString()}`);
    await verifyContract(factory.target, '');
    await verifyContract(pair.target, '');
    await verifyContract(router.target, factory.target as string);
    await verifyContract(flashloaner!.target, '');
}


/* serialization for testnet and mainnet test */ 

// serialize basic test contracts addresses to a file
export function serializeBasicTestContracts(contracts: BasicTestContracts, filename: string) {
    const { tokenA, tokenB, factory, pair, router, flashloaner } = contracts;
    const context = {
        tokenAAddr: tokenA.target,
        tokenBAddr: tokenB.target,
        factoryAddr: factory.target,
        pairAddr: pair.target,
        routerAddr: router.target,
        flashloanerAddr: flashloaner.target,
    };
    fs.writeFileSync(filename, JSON.stringify(context));
}


// deserialize basic test contracts addresses from a file and return the contracts
export async function deserializeBasicTestContracts(filename: string): Promise<BasicTestContracts> {
    const context = fs.readFileSync(filename, 'utf8');
    const { tokenAAddr, tokenBAddr, factoryAddr, pairAddr, routerAddr, flashloanerAddr } = JSON.parse(context);

    const MyERC20TokenOZ = await ethers.getContractFactory("MyERC20TokenOZ");
    const tokenA = await MyERC20TokenOZ.attach(tokenAAddr) as any;
    const tokenB = await MyERC20TokenOZ.attach(tokenBAddr) as any;

    const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await UniswapV2Factory.attach(factoryAddr) as any;

    const pair = await getPairContractFromAddress(pairAddr);

    const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
    const router = await UniswapV2Router02.attach(routerAddr) as any;

    const FlashloanTest = await ethers.getContractFactory("FlashloanTest");
    const flashloaner = await FlashloanTest.attach(flashloanerAddr) as any;

    return { tokenA, tokenB, factory, pair, router, flashloaner };
}


// Thijs should only be run in local test
export async function basicTest(signers: Signers, contracts: BasicTestContracts, localTest: boolean = false) {

    const { owner, swapper } = signers;
    const { tokenA, tokenB, pair, router } = contracts;
    const fmt = getBigIntAmountFormater(DECIMALS);
    const MINIMUM_LIQUIDITY = 1000n;

    console.log('\n** tokens **');
    console.log('tokenA = ', tokenA.target, 'tokenB = ', tokenB.target);   
    console.log('pair token0 = ', await pair.token0(), 'pair token1 = ', await pair.token1());


    /* add liquidity */
    const time_in_the_future = Date.now() + 1000000000;
    const stakeAmount = 1000n * DECIMALS_MULTIPLIER;
    console.log('\nApproving the router to transfer tokenA and tokenB from owner ...');
    await waitForTxs([await tokenA.approve(router.target, stakeAmount), 
                      await tokenB.approve(router.target, stakeAmount)]);
    console.log('Adding liquidity ...');
    await tx(router.addLiquidity(tokenA.target, tokenB.target, stakeAmount, stakeAmount, 0, 0, owner.address, time_in_the_future));
    

    // check staked liquidity
    let liquidity = await pair.balanceOf(owner.address);
    let reserves = await pair.getReserves() as [bigint, bigint];
    console.log('owner staked', fmt(stakeAmount), 'tokenA and', fmt(stakeAmount), 'tokenB to liquidity pool');
    console.log('in return, owner got ', fmt(liquidity), 'liquidity tokens'); 
    console.log('pair reserves: token0 = ', fmt(reserves[0]), 'token1 = ', fmt(reserves[1])); 
    console.log('pair liquidity tokens totalSupply = ', fmt(await pair.totalSupply()));
    if (localTest) {
        expect(liquidity).to.be.above(0);
        expect(reserves[0]).to.equal(stakeAmount);
        expect(reserves[1]).to.equal(stakeAmount);
        expect(await pair.totalSupply()).to.equal(liquidity + MINIMUM_LIQUIDITY); 
    }

    /* swap */
    const tokenAAmountIn = 100n * DECIMALS_MULTIPLIER;
    // //transfer 100 token0 to swapper and allows router to transfer these tokens on behalf of swapper
    console.log('\nSend some tokenA to swapper and approve router to transfer them ... ');
    await waitForTxs([await tokenA.transfer(swapper!.address, tokenAAmountIn),   
                      await tokenA.connect(swapper).approve(router.target, tokenAAmountIn)]);  
    console.log('Swapping ... ');
    await tx(router.connect(swapper).swapExactTokensForTokens
        (tokenAAmountIn, 0, [tokenA.target, tokenB.target], swapper!.address, time_in_the_future));


    // check swapped amount 
    let tokenBAmountOut = await tokenB.balanceOf(swapper!.address);
    console.log('swapper swapped ', fmt(tokenAAmountIn), 'tokenA for', fmt(tokenBAmountOut), 'tokenB');
    reserves = await pair.getReserves() as [bigint, bigint];
    console.log('pair reserves: token0 = ', fmt(reserves[0]), 'token1 = ', fmt(reserves[1])); 
    reserves = tokenA.target == (await pair.token0()) ? reserves : [reserves[1], reserves[0]];
    if (localTest) {
        expect(tokenBAmountOut).to.be.above(0);
        expect(reserves[0]).to.equal(stakeAmount + tokenAAmountIn);
        expect(reserves[1]).to.equal(stakeAmount - tokenBAmountOut);
    }

    /* remove liquidity */
    console.log('\nApproving the router to transfer liquidity tokens from owner ...');
    await tx(pair.approve(router.target, liquidity));
    console.log('Removing liquidity ...');
    await tx(router.removeLiquidity
        (tokenA.target, tokenB.target, liquidity, 0, 0, owner.address, time_in_the_future));


    // check removed liquidity
    const ownerToken0 = await tokenA.balanceOf(owner.address);
    const ownerToken1 = await tokenB.balanceOf(owner.address);
    console.log('owner redeemed', fmt(liquidity), 'liquidity tokens');
    console.log('in turn, owner got', fmt(await tokenA.balanceOf(owner.address) - ownerToken0), 'token0 and',  
                fmt(await tokenB.balanceOf(owner.address) - ownerToken1), 'token1');

    reserves = await pair.getReserves() as [bigint, bigint];
    console.log('pair reserves: token0 = ', fmt(reserves[0]), 'token1 = ', fmt(reserves[1])); 
    console.log('pair liquidity tokens totalSupply = ', fmt(await pair.totalSupply()));
    if (localTest) {
        expect(reserves[0]).to.be.above(0);
        expect(reserves[1]).to.be.above(0);
        expect(await pair.totalSupply()).to.equal(MINIMUM_LIQUIDITY);   // permanently locked liquidity
    }
}


// test flashloan
export async function flashloanTest(signers: Signers, contracts: BasicTestContracts, localTest: boolean = false) {

    console.log('\n');

    const { owner } = signers;
    const { tokenA, tokenB, pair, router, flashloaner } = contracts;
    const fmt = getBigIntAmountFormater(DECIMALS);

    const time_in_the_future = Date.now() + 1000000000;
    const stakeAmount = 1000n * DECIMALS_MULTIPLIER;

    console.log('Approving the router to transfer tokenA and tokenB from Staking liquidity to pair ...');
    await waitForTxs([await tokenA.approve(router.target, stakeAmount),             // for staking tokenA
                      await tokenB.approve(router.target, stakeAmount),             // for staking tokenB
                      await tokenA.transfer(flashloaner.target, stakeAmount),       // for flashloaner to repay tokenA
                      await tokenB.transfer(flashloaner.target, stakeAmount)]);     // for flashloaner to repay tokenB
    console.log('Staking liquidity to pair ...');
    await tx(router.addLiquidity(tokenA.target, tokenB.target, stakeAmount, stakeAmount, 0, 0, owner.address, time_in_the_future));

    // flashloan

    // /*
    //     We are demonstrating flashloan here with over-repayment. This means that we borrow 1000 tokens and later repay
    //     1004 tokens. This is not profitable but the point is to demonstrate that we can borrow without collateral.
    //     In practical use, we would use these borrowed 1000 tokens to trade for a profit, like end up with 1100 tokens, 
    //     then we issue the repayment of 1004 tokens, and keep the 96 tokens as profit.

    //     For this test, because the owner has sent some token0 to the flashloaner in advance, it can afford to repay 
    //     a little more than what it borrowed.
    // */

    // flashloan, note that we are calling the pair directly
    console.log('Sending flashloan request ...');
    const abi = AbiCoder.defaultAbiCoder();
    const loanAmount = stakeAmount / 2n;
    await tx(pair.swap(
        loanAmount,        // only borrow token0
        0,
        flashloaner.target,
        abi.encode(['uint'], [123n])));
    console.log(`Borrowed ${fmt(loanAmount)} tokenA without collateral ...`);
}

