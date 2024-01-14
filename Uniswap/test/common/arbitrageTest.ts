const { expect } = require("chai");
import * as fs from 'fs';

import { AbiCoder } from "ethers";
import { ethers } from "hardhat";
import { UniswapV2Pair } from "../../typechain-types/UniswapV2Pair";
import { UniswapV2Factory } from "../../typechain-types/UniswapV2Factory";
import { ArbitrageTest, MyERC20TokenOZ } from "../../typechain-types";
import { UniswapV2Router02 } from "../../typechain-types/UniswapV2Router02";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DECIMALS, DECIMALS_MULTIPLIER, Signers, TEST_TOKEN_INITIAL_SUPPLY, deployTx, getBigIntAmountFormater, getPairContract, getPairContractFromAddress, tx, verifyContract } from "./common";
import { experimentalAddHardhatNetworkMessageTraceHook } from 'hardhat/config';


/*

    This is a test to demonstrate using flashloan to arbitrage. The test setup has four tokens and four token pairs:

    t[0], t[1]
    t[0], t[2]
    t[1], t[2]
    t[0], t[3]

    We assume that the triangle t[0], t[1], t[2] has market inefficiency such that there is arbitrage opportunity.
    The flashloaner borrows t[0] from the t[0], t[3] pair and use that to trade in the t[0], t[1], t[2] triangle.
    Some of the profit is paid as fee to the t[0], t[3] pair and the rest is kept as profit.

    In a practical setting, an off-chain program would be used to identify such arbitrage opportunity and to 
    calculate the optimal amount to borrow and trade.

    In a practical setting, frontrunning should be considered.

*/


const NUM_TEST_TOKENS = 4;
const PairTokenIndices = [
    [0, 1],     // pair[0] trades tokens[0] and tokens[1]
                // note that tokens[0] is not the same as token0 in the pair
                // token0 and token1 in the pair are sorted lexically
                // while here token[0], token[1], token[2] are merely our list of test tokens which is not sorted lexically
    [0, 2],
    [1, 2],
    [0, 3]
];


/*
    we set up the following prices reflecting market inefficiency:

    t[0], t[1]:   1000, 2000        (1 t[0] = 2 t[1]  roughly)
    t[1], t[2]:   1500, 1000        (3 t[1] = 2 t[2]  roughly)
    t[0], t[2]:   1000, 1000        (1 t[0] = 1 t[2]  roughly)

    this way, 300 t[0] -> 600 t[1] -> 400 t[2] -> 400 t[0]  (rougly)  is likely a profitable triangle trade.

    we then have a pair:

    t[0], t[3]:   2000, 2000        for liquidity borrowing. We don't trade in this pair, 
                                    just use it as a source to fund the trade through flashloan.

*/

// before mulitiplying with DECIMALS_MULTIPLIER
const PairLiquidities = [
    [1000n, 2000n],
    [1000n, 1000n],
    [1500n, 1000n],
    [2000n, 2000n]
]
// const PairLiquidities = [
//     [1000n, 1800n],
//     [900n, 1000n],
//     [1500n, 900n],
//     [2000n, 2000n]
// ]
const STAKING_ALLOWANCE = 10000n * DECIMALS_MULTIPLIER;



interface ArbitrageTestContracts {
    tokens: MyERC20TokenOZ[];
    factory: UniswapV2Factory;
    pairs: UniswapV2Pair[]; 
    router: UniswapV2Router02;
    arbitrageur: ArbitrageTest;
}


// Deploy arbitrage test contracts
export async function deployArbitrageTestContracts(signers: Signers, localTest: boolean = false): Promise<ArbitrageTestContracts> {
    console.log("\n\n");

    const { owner } = signers;


    // Deploy tokens, factory, router
    console.log('Deploying testing tokens ...');
    const tokens: MyERC20TokenOZ[] = [];
    for (let i = 0; i < NUM_TEST_TOKENS; i++) {
        console.log(`Deploying token: ArbTestToken[${i}] ...`);
        tokens.push(await deployTx(ethers.deployContract
            ("MyERC20TokenOZ", [`ArbTestToken[${i}]`, `ATT[${i}]`, DECIMALS, TEST_TOKEN_INITIAL_SUPPLY])));
    }

    console.log('Deploying factory contract ...');
    const factory = await deployTx(ethers.deployContract("UniswapV2Factory", []));

    console.log('Deploying router contract ...');    
    const router = await deployTx(ethers.deployContract("UniswapV2Router02", [factory.target]));


    // creating pairs
    console.log('Creating testing pairs ...');    
    const pairs: UniswapV2Pair[] = [];
    for (let pairInd = 0; pairInd < PairTokenIndices.length; pairInd++) {
        const [i, j] = PairTokenIndices[pairInd];
        console.log(`Creating testing pair for ArbTestToken[${i}] and ArbTestToken[${j}] ...`);
        await tx(factory.createPair(tokens[i].target, tokens[j].target));
        pairs.push(await getPairContract(factory, tokens[i].target as string, tokens[j].target as string));
    };


    // Deploy arbitrageur
    console.log('Deploying arbitraguer contract ...');    
    const arbitrageur = await deployTx(ethers.deployContract("ArbitrageTest", [factory.target, router.target]));


    if (localTest) {            
        tokens.forEach(async (token) => {
            expect(await token.totalSupply()).to.equal(await token.balanceOf(owner.address));
        });
        expect(await factory.allPairsLength()).to.equal(PairTokenIndices.length);
        expect(await router.factory()).to.equal(factory.target);
    }

    return {
        tokens,
        factory,
        pairs: pairs,
        router,
        arbitrageur
    };
}


export function printArbitrageTestContracts(contracts: ArbitrageTestContracts) {
    const { tokens, factory, pairs, router, arbitrageur } = contracts;

    console.log('\nArbitrage test contracts:');
    console.log('tokens = ', tokens.map(t => t.target));
    console.log('factory = ', factory.target);
    console.log('pairs = ', pairs.map(p => p.target));
    console.log('router = ', router.target);
    console.log('arbitrageur = ', arbitrageur.target);
}


export async function verifyArbitrageTestContracts(contracts: ArbitrageTestContracts) {
    console.log('Verifying contracts ...');
    const { tokens, factory, pairs, router, arbitrageur } = contracts;

    for (let i = 0; i < tokens.length; i++) {
        const initArgsStr = `"ArbTestToken[${i}]" "ATT[${i}]" ${DECIMALS.toString()} ${TEST_TOKEN_INITIAL_SUPPLY.toString()}`;
        await verifyContract(tokens[i].target as string, initArgsStr);
    }
    await verifyContract(factory.target as string, '');
    for (let i = 0; i < pairs.length; i++) {
        await verifyContract(pairs[i].target as string, '');
    }
    await verifyContract(router.target as string, contracts.factory.target as string);
    await verifyContract(arbitrageur.target as string, `${factory.target} ${router.target}`);
}


/* serialization for testnet and mainnet test */ 

// serialize arbitrage test contracts addresses to a file
export function serializeArbitrageTestContracts(contracts: ArbitrageTestContracts, filename: string) {
    const { tokens, factory, pairs, router, arbitrageur } = contracts;
    const context = {
        tokenAddrs: tokens.map(t => t.target),
        factoryAddr: factory.target,
        pairAddrs: pairs.map(p => p.target),
        routerAddr: router.target,
        arbitrageurAddr: arbitrageur.target,
    };
    fs.writeFileSync(filename, JSON.stringify(context));
}


// deserialize arbitrage test contracts addresses from a file and return the contracts
export async function deserializeArbitrageTestContracts(filename: string): Promise<ArbitrageTestContracts> {
    const context = fs.readFileSync(filename, 'utf8');
    const { tokenAddrs, factoryAddr, pairAddrs, routerAddr, arbitrageurAddr } = JSON.parse(context);

    const MyERC20TokenOZ = await ethers.getContractFactory("MyERC20TokenOZ");
    const tokens = await Promise.all(tokenAddrs.map(async (addr: string) => {
        return await MyERC20TokenOZ.attach(addr) as any;
    }));

    const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await UniswapV2Factory.attach(factoryAddr) as any;

    const pairs = await Promise.all(pairAddrs.map(getPairContractFromAddress));

    const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
    const router = await UniswapV2Router02.attach(routerAddr) as any;

    const ArbitrageTest = await ethers.getContractFactory("FlashloanTest");
    const arbitrageur = await ArbitrageTest.attach(arbitrageurAddr) as any;

    return { tokens, factory, pairs, router, arbitrageur };
}


// Test arbitrage
// Note: whether the arbitrage is profitable depends on the initial reserves in the pairs
//       Depending on the initial pair reserves, this arbitrage might fail due to a lack of 
//       profitability when tested on the testnet or the mainnet, 
export async function arbitrageTest(signers: Signers, contracts: ArbitrageTestContracts, localTest: boolean = false) {

    const { owner } = signers;
    const { tokens, pairs, factory, router, arbitrageur } = contracts;

    const time_in_the_future = Date.now() + 1000000000;
    const fmt = getBigIntAmountFormater(DECIMALS);

    console.log('\n** tokens **');
    tokens.forEach((token, i) => {
        console.log(`token[${i}]:  ArbTestToken[${i}] = `, token.target);
    });

    await Promise.all(pairs.map(async (pair, pairInd) => {
        const [i, j] = PairTokenIndices[pairInd];
        console.log(`pair[${i}] trades ArbTestToken[${i}] and ArbTestToken[${j}], `,
                    'token 0 = ', await pair.token0(), 'token1 = ', await pair.token1());
    }));



    /* try cleaning up liquiity first */
    // If no one else have used the contracts, this should rest the pairs.
    // Then we can stake liquidity to test the arbitrage with profit. 
    // If we do not clean up liquidity, the arbitrage might not be profitable.
    // If other people have used the contracts, then this might not work. 
    // In that case, it is best to redeploy.
    console.log('\nCleaning up liquidity ...');

    for (let pairInd = 0; pairInd < pairs.length; pairInd++) {
        const pair = pairs[pairInd];
        const [i, j] = PairTokenIndices[pairInd];
        if (await pair.totalSupply() == 0n) {
            continue;
        }
        console.log(`Cleaning up liquidity for pair ${pair.target} which trades ArbTestToken[${i}] and ArbTestToken[${j}] ...`);
        const liquidity = await pair.balanceOf(owner.address);
        await tx(pair.approve(router.target, liquidity)); 
        await tx(router.removeLiquidity(pair.token0(), pair.token1(), liquidity, 0, 0, owner.address, time_in_the_future));
    }


    /* staking liquidity */

    console.log('\nApproving to transfer tokens ...');
    for (let i = 0; i < tokens.length; i++) {
        console.log(`Approving to transfer token ArbTestToken[${i}]...`);
        await tx(tokens[i].approve(router.target, STAKING_ALLOWANCE));
    };

    console.log('\nStaking liquidity to the pairs ...');
    for (let pairInd = 0; pairInd < pairs.length; pairInd++) {
        const pair = pairs[pairInd];
        const [i, j] = PairTokenIndices[pairInd];
        const [li, lj] = PairLiquidities[pairInd];
        console.log(`Staking liquidity to paid for ArbTestToken[${i}] and ArbTestToken[${j}]...`);

        // Here we stake liquidity by directly calling the pair contract.
        // This way we have full control of the staked liquidity. 
        // 
        // The router contract would enforce that the staked liquidity confroms to the  
        // pair's reserves ratio. For example, if the pair has little liquidity left, like 
        // reserves = [500, 2000], then the router would insist that we stakes token0 and token1
        // in the ratio of 1:4. This makes it hard to reset the pair.
        //
        // By calling the pair directly, we can stake [1000000000000000000000, 1000000000000000000000] 
        // liquidity (1:1 ratio) even if the current reserves are [500, 2000]. 
        await tx(tokens[i].transfer(pair.target, li * DECIMALS_MULTIPLIER));
        await tx(tokens[j].transfer(pair.target, lj * DECIMALS_MULTIPLIER));
        await tx(pair.mint(owner.address));
        // await tx(router.addLiquidity(
        //     tokens[i].target, tokens[j].target, 
        //     li * DECIMALS_MULTIPLIER, lj * DECIMALS_MULTIPLIER, 
        //     0, 0, owner.address, time_in_the_future));
    }


    /* arbitrage */

    console.log('\nSending arbitrage request ...');

    const abi = AbiCoder.defaultAbiCoder();
    const pair = await getPairContract(factory, tokens[0].target as string, tokens[3].target as string); 
    const pairToken0 = await pair.token0(); 

    // set amount0/1Out according to whether token0 is token0 in the pair
    const borrowAmount = 50n * DECIMALS_MULTIPLIER;
    const amount0Out = tokens[0].target === pairToken0 ? borrowAmount : 0n;
    const amount1Out = tokens[0].target === pairToken0 ? 0n : borrowAmount;

    // now, specify the arbitrage path (token[0], token[1], token[2], token[1] and execute arbitrage
    const beforeBalance = await tokens[0].balanceOf(arbitrageur.target);
    await tx(pair.swap(
        amount0Out,
        amount1Out,
        arbitrageur.target,
        abi.encode(['address[]'], [ [tokens[0].target, tokens[1].target, tokens[2].target, tokens[0].target] ])
    ));
    const afterBalance = await tokens[0].balanceOf(arbitrageur.target);
    console.log(`borrowed ${fmt(borrowAmount)} ArbTestToken[0], arbitrage profit = ${fmt(afterBalance - beforeBalance)} ArbTestToken[0]`);
    
    // expect to be profitable
    if (localTest) {
        expect(afterBalance).to.be.above(beforeBalance);
    }
}
