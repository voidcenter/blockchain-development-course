const { expect } = require("chai");
import { ethers } from "hardhat";
import * as fs from 'fs';

import { UniswapV2Pair } from "../../typechain-types/UniswapV2Pair";
import { UniswapV2Factory } from "../../typechain-types/UniswapV2Factory";
import { MyERC20TokenOZ } from "../../typechain-types";
import { UniswapV2Router02 } from "../../typechain-types/UniswapV2Router02";
import { DECIMALS, DECIMALS_MULTIPLIER, TEST_TOKEN_INITIAL_SUPPLY } from "./common";
import { getBigIntAmountFormater, tx, deployTx } from "./common";
import { Signers } from "./common";


// These types are all taken care of by hardhat-typechain
export interface BasicTestContracts {
    token0: MyERC20TokenOZ;
    token1: MyERC20TokenOZ;
    factory: UniswapV2Factory;
    pair: UniswapV2Pair;
    router: UniswapV2Router02;
}


// Deploy all contracts needed for a basic test
// Takes about 1.5 ETH To deploy all of these
export async function deployBasicTestContracts(signers: Signers, localTest: boolean = false): Promise<BasicTestContracts> {

    const { owner, swapper } = signers;

    // deploy token0, token1, factory
    const token0 = await deployTx(ethers.deployContract("MyERC20TokenOZ", ["Token0", "T0", DECIMALS, TEST_TOKEN_INITIAL_SUPPLY]));
    const token1 = await deployTx(ethers.deployContract("MyERC20TokenOZ", ["Token1", "T1", DECIMALS, TEST_TOKEN_INITIAL_SUPPLY]));
    const factory = await deployTx(ethers.deployContract("UniswapV2Factory", []));

    // console.log('token0 = ', token0.target);
    // console.log('token1 = ', token1.target);
    // console.log('factory = ', factory.target);

    // create pair and deploy router
    await tx(factory.createPair(token0.target, token1.target));
    const router = await deployTx(ethers.deployContract("UniswapV2Router02", [factory.target]));

    
    // const MyERC20TokenOZ = await ethers.getContractFactory("MyERC20TokenOZ");
    // const token0 = await MyERC20TokenOZ.attach('0xe06b6809ac256e427b50133c2b67f890e3a5c1e0') as any;
    // const token1 = await MyERC20TokenOZ.attach('0x37c104b08242a3cc9860f990b20206632bae15d9') as any;

    // const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
    // const factory = await UniswapV2Factory.attach('0x766d24d59962e6cffc1a7aec7f8a76d7b7598a1d') as any;

    // const UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair");
    // const pair = await UniswapV2Pair.attach('0x20b51B66F859206EEFF70E01Ba1F2cAB36Fc307F') as any;

    // const router = await deployTx(ethers.deployContract("UniswapV2Router02", ['0x766d24d59962e6cffc1a7aec7f8a76d7b7598a1d']));


    // console.log('router = ', router.target);

    // get pair contract
    const pairAddress = await factory.getPair(token0.target, token1.target);
    const UniswapV2PairFactory = await ethers.getContractFactory("UniswapV2Pair");
    const pair = await UniswapV2PairFactory.attach(pairAddress) as any;

    // console.log('pair = ', pair.target);


    if (localTest) {    
        expect(await token0.totalSupply()).to.equal(await token0.balanceOf(owner.address));
        expect(await token1.totalSupply()).to.equal(await token1.balanceOf(owner.address));
        expect(await factory.allPairsLength()).to.equal(1);
        expect(await pair.decimals()).to.equal(DECIMALS);
        expect(await router.factory()).to.equal(factory.target);
    }


    // console.log('pair = ', pair.target);

    // // const token0Addr = '0x92D606FF7c9e2C4f3B68D2F0A336A7B30aFf158F';
    // // const token1Addr = '0x6a9CB463A45F975EdD8aF0aF318f8C1C81332439';

    // // const MyERC20TokenOZ = await ethers.getContractFactory("MyERC20TokenOZ");
    // // const token0 = await MyERC20TokenOZ.attach(token0Addr) as any;
    // // const token1 = await MyERC20TokenOZ.attach(token1Addr) as any;

    // console.log('token0 = ', token0.target);
    // // console.log('token1 = ', token1.target);
    // console.log(await token0.totalSupply());

    return {
        token0,
        token1,
        factory,
        pair,
        router,
    };
}


export function printBasicTestContracts(contracts: BasicTestContracts) {
    console.log('\n** context **');
    console.log('token0 = ', contracts.token0.target);
    console.log('token1 = ', contracts.token1.target);
    console.log('factory = ', contracts.factory.target);
    console.log('pair = ', contracts.pair.target);
    console.log('router = ', contracts.router.target);
    console.log('\n');
}


/* serialization for testnet and mainnet test */ 

// serialize basic test contracts addresses to a file
export function serializeBasicTestContracts(contracts: BasicTestContracts, filename: string) {
    const { token0, token1, factory, pair, router } = contracts;
    const context = {
        token0Addr: token0.target,
        token1Addr: token1.target,
        factoryAddr: factory.target,
        pairAddr: pair.target,
        routerAddr: router.target,
    };
    fs.writeFileSync(filename, JSON.stringify(context));
}


// deserialize basic test contracts addresses from a file and return the contracts
export async function deserializeBasicTestContracts(filename: string): Promise<BasicTestContracts> {
    const context = fs.readFileSync(filename, 'utf8');
    const { token0Addr, token1Addr, factoryAddr, pairAddr, routerAddr } = JSON.parse(context);

    const MyERC20TokenOZ = await ethers.getContractFactory("MyERC20TokenOZ");
    const token0 = await MyERC20TokenOZ.attach(token0Addr) as any;
    const token1 = await MyERC20TokenOZ.attach(token1Addr) as any;

    const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await UniswapV2Factory.attach(factoryAddr) as any;

    const UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair");
    const pair = await UniswapV2Pair.attach(pairAddr) as any;

    const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
    const router = await UniswapV2Router02.attach(routerAddr) as any;

    return { token0, token1, factory, pair, router };
}


// Thijs should only be run in local test
export async function basicTest(signers: Signers, context: BasicTestContracts, localTest: boolean = false) {

    const { owner, swapper } = signers;
    const { token0, token1, pair, router } = context;
    const fmt = getBigIntAmountFormater(DECIMALS);
    const MINIMUM_LIQUIDITY = 1000n;


    // add liquidity
    console.log('\n** add liquidity **');
    const time_in_the_future = Date.now() + 1000000000;
    const stakeAmount = 1000n * DECIMALS_MULTIPLIER;
    await tx(token0.approve(router.target, stakeAmount));
    await tx(token1.approve(router.target, stakeAmount));
    await tx(router.addLiquidity(token0.target, token1.target, stakeAmount, stakeAmount, 0, 0, owner.address, time_in_the_future));
    
    // check staked liquidity
    let liquidity = await pair.balanceOf(owner.address);
    let reserves = await pair.getReserves() as [bigint, bigint];
    console.log('owner staked', fmt(stakeAmount), 'token0 and', fmt(stakeAmount), 'token1 to liquidity pool');
    console.log('in return, owner got ', fmt(liquidity), 'liquidity tokens'); 
    console.log('pair reserves = ', fmt(reserves[0]), fmt(reserves[1])); 
    console.log('pair supply = ', fmt(await pair.totalSupply()));
    if (localTest) {
        expect(liquidity).to.be.above(0);
        expect(reserves[0]).to.equal(stakeAmount);
        expect(reserves[1]).to.equal(stakeAmount);
        expect(await pair.totalSupply()).to.equal(liquidity + MINIMUM_LIQUIDITY); 
    }


    // swap
    console.log('\n** swap **');
    const token0AmountIn = 100n * DECIMALS_MULTIPLIER;
    await token0.transfer(swapper!.address, token0AmountIn);   //transfer 100 token0 to swapper
    await tx(token0.connect(swapper).approve(router.target, token0AmountIn));  // swapper allows the router to spend 100 token0
    await tx(router.connect(swapper).swapExactTokensForTokens
        (token0AmountIn, 0, [token0.target, token1.target], swapper!.address, time_in_the_future));

    // check swapped amount 
    let token1AmountOut = await token1.balanceOf(swapper!.address);
    console.log('swapper swapped ', fmt(token0AmountIn), 'token0 for', fmt(token1AmountOut), 'token1');
    reserves = await pair.getReserves() as [bigint, bigint];
    reserves = token0.target == (await pair.token0()) ? reserves : [reserves[1], reserves[0]];
    console.log('pair reserves = ', fmt(reserves[0]), fmt(reserves[1])); 
    if (localTest) {
        expect(token1AmountOut).to.be.above(0);
        expect(reserves[0]).to.equal(stakeAmount + token0AmountIn);
        expect(reserves[1]).to.equal(stakeAmount - token1AmountOut);
    }

    // remove liquidity
    console.log('\n** remove liquidity **');
    const ownerToken0 = await token0.balanceOf(owner.address);
    const ownerToken1 = await token1.balanceOf(owner.address);
    await tx(pair.approve(router.target, liquidity));
    await tx(router.removeLiquidity
        (token0.target, token1.target, liquidity, 0, 0, owner.address, time_in_the_future));
    console.log('owner redeemed', fmt(liquidity), 'liquidity tokens');
    console.log('in turn, owner got', fmt(await token0.balanceOf(owner.address) - ownerToken0), 'token0 and',  
                fmt(await token1.balanceOf(owner.address) - ownerToken1), 'token1');

    // check removed liquidity
    reserves = await pair.getReserves() as [bigint, bigint];
    console.log('pair reserves = ', fmt(reserves[0]), fmt(reserves[1])); 
    console.log('pair supply = ', fmt(await pair.totalSupply()));
    if (localTest) {
        expect(reserves[0]).to.be.above(0);
        expect(reserves[1]).to.be.above(0);
        expect(await pair.totalSupply()).to.equal(MINIMUM_LIQUIDITY);   // permanently locked liquidity
    }
}
