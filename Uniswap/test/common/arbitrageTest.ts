const { expect } = require("chai");
import * as fs from 'fs';

import { AbiCoder } from "ethers";
import { ethers } from "hardhat";
import { UniswapV2Pair } from "../../typechain-types/UniswapV2Pair";
import { UniswapV2Factory } from "../../typechain-types/UniswapV2Factory";
import { ArbitrageTest, MyERC20TokenOZ } from "../../typechain-types";
import { UniswapV2Router02 } from "../../typechain-types/UniswapV2Router02";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DECIMALS, DECIMALS_MULTIPLIER, Signers, TEST_TOKEN_INITIAL_SUPPLY, deployTx, getBigIntAmountFormater, getPairContract, getPairContractFromAddress, tx, verifyContract, waitForDeployTxs, waitForTxs } from "./common";
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
const PairLiquidity = [
    [1000n, 2000n],
    [1000n, 1000n],
    [1500n, 1000n],
    [2000n, 2000n]
]


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
    let txs;
    let deployTxs;


    // Deploy tokens and factory
    console.log('Deploying testing tokens ...');
    deployTxs = [];
    for (let i = 0; i < NUM_TEST_TOKENS; i++) {
        console.log(`Deploying token: ArbTestToken[${i}] ...`);
        deployTxs.push(await ethers.deployContract
            ("MyERC20TokenOZ", [`ArbTestToken[${i}]`, `ATT[${i}]`, DECIMALS, TEST_TOKEN_INITIAL_SUPPLY]));
    }
    
    console.log('Deploying factory contract ...');
    deployTxs.push(await ethers.deployContract("UniswapV2Factory", []));

    const cs = await waitForDeployTxs(deployTxs);
    const tokens = cs.slice(0, cs.length - 1) as MyERC20TokenOZ[];
    const factory = cs[cs.length - 1] as UniswapV2Factory;


    // Deploy router and create pairs 
    console.log('Deploying router contract ...');    
    deployTxs = [];
    deployTxs.push(await ethers.deployContract("UniswapV2Router02", [factory.target]));

    console.log('Creating testing pairs ...');    
    txs = [];
    for (let pairInd = 0; pairInd < PairTokenIndices.length; pairInd++) {
        const [i, j] = PairTokenIndices[pairInd];
        console.log(`Creating testing pair for ArbTestToken[${i}] and ArbTestToken[${j}] ...`);
        txs.push(await factory.createPair(tokens[i].target, tokens[j].target));
    };

    const [router] = (await waitForDeployTxs(deployTxs)) as [UniswapV2Router02];
    await waitForTxs(txs);

    const pairs = await Promise.all(PairTokenIndices.map(async ([i, j]) => {
        return await getPairContract(factory, tokens[i].target, tokens[j].target);
    }));


    // Deploy arbitrageur and approve router to transfer tokens
    console.log('Deploying arbitraguer contract ...');    
    deployTxs = [];
    deployTxs.push(await ethers.deployContract("ArbitrageTest", [factory.target, router.target]));

    // Approve router to transfer owner's tokens: testing tokens and liquidity tokens
    // This saves the effort to repeatedly approve the router to transfer tokens
    // In practice, you should not do this as this is not secure.
    console.log('Approving the router to transfer tokens ...');
    txs = [];
    for (let i = 0; i < tokens.length; i++) {
        console.log(`Approving router to transfer token ArbTestToken[${i}] from owner ...`);
        // approve to transfer the entire circulation 
        txs.push(await tokens[i].approve(router.target, TEST_TOKEN_INITIAL_SUPPLY));
    };
    for (let i = 0; i < pairs.length; i++) {
        console.log(`Approving router to transfer liquidity token of pair ${pairs[i].target} from owner ...`);
        // approve to transfer a big number which should be higher than the pair's liquidity token circulation
        txs.push(await pairs[i].approve(router.target, TEST_TOKEN_INITIAL_SUPPLY));
    }

    const [arbitrageur] = (await waitForDeployTxs(deployTxs)) as [ArbitrageTest];
    await waitForTxs(txs);


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


// Promise.all seems to throw errors, maybe etherscan has some kind of rate limiting.
export async function verifyArbitrageTestContracts(contracts: ArbitrageTestContracts) {
    console.log('Verifying contracts ...');
    const { tokens, factory, pairs, router, arbitrageur } = contracts;

    for (let i = 0; i < tokens.length; i++) {
        const initArgsStr = `"ArbTestToken[${i}]" "ATT[${i}]" ${DECIMALS.toString()} ${TEST_TOKEN_INITIAL_SUPPLY.toString()}`;
        await verifyContract(tokens[i].target, initArgsStr);
    }
    await verifyContract(factory.target, '');
    for (let i = 0; i < pairs.length; i++) {
        await verifyContract(pairs[i].target, '');
    }
    await verifyContract(router.target, contracts.factory.target as string);
    await verifyContract(arbitrageur.target, `${factory.target} ${router.target}`);
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

    console.log('\n== Arbitrage test ==');

    const { owner } = signers;
    const { tokens, pairs, factory, router, arbitrageur } = contracts;

    const time_in_the_future = Date.now() + 1000000000;
    const fmt = getBigIntAmountFormater(DECIMALS);
    let txs;

    console.log('\n** tokens **');
    tokens.forEach((token, i) => {
        console.log(`token[${i}]:  ArbTestToken[${i}] = `, token.target);
    });

    await Promise.all(pairs.map(async (pair, pairInd) => {
        const [i, j] = PairTokenIndices[pairInd];
        console.log(`pair[${i}] trades ArbTestToken[${i}] and ArbTestToken[${j}], `,
                    'token 0 = ', await pair.token0(), 'token1 = ', await pair.token1());
    }));


    /* Reseeting the pairs by removing liquidity */

    // If no one else have used the contracts, this should rest the pairs.
    // Then we can stake liquidity to test the arbitrage with profit. 
    // If we do not clean up liquidity, the arbitrage might not be profitable.
    // If other people have used the contracts, then this might not work. 
    // In that case, it is best to redeploy.
    console.log('\nResetting the pairs by draining liquidity ...');

    txs = [];
    for (let pairInd = 0; pairInd < pairs.length; pairInd++) {
        const pair = pairs[pairInd];
        if (await pair.totalSupply() == 0n) {
            continue;
        }
        const [i, j] = PairTokenIndices[pairInd];
        const liquidity = await pair.balanceOf(owner.address);
        console.log(`Cleaning up liquidity for pair ${pair.target} which trades ArbTestToken[${i}] and ArbTestToken[${j}] ...`);
        txs.push(await router.removeLiquidity(pair.token0(), pair.token1(), liquidity, 0, 0, owner.address, time_in_the_future));
    }
    await waitForTxs(txs);


    /* staking liquidity */

    console.log('\nStaking liquidity to the pairs ...');

    txs = [];
    for (let pairInd = 0; pairInd < pairs.length; pairInd++) {
        const pair = pairs[pairInd];
        const [i, j] = PairTokenIndices[pairInd];
        const [li, lj] = PairLiquidity[pairInd];
        console.log(`Staking liquidity to pair (ArbTestToken[${i}], ArbTestToken[${j}])...`);

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
        txs.push(await tokens[i].transfer(pair.target, li * DECIMALS_MULTIPLIER));
        txs.push(await tokens[j].transfer(pair.target, lj * DECIMALS_MULTIPLIER));
    }
    await waitForTxs(txs);

    txs = [];
    for (let pairInd = 0; pairInd < pairs.length; pairInd++) {
        const pair = pairs[pairInd];
        txs.push(await pair.mint(owner.address));
    }
    await waitForTxs(txs);


    console.log('pair liqiudity before arbitrage:');
    for (let pairInd = 0; pairInd < pairs.length; pairInd++) {
        const pair = pairs[pairInd];
        const [i, j] = PairTokenIndices[pairInd];
        const reserves = await pair.getReserves();
        console.log(`pair (ArbTestToken[${i}], ArbTestToken[${j}]) (${tokens[i].target}, ${tokens[j].target}) liquidity = `, 
            await pair.token0() === tokens[i].target ? fmt(reserves[0]) : fmt(reserves[1]),
            await pair.token0() === tokens[i].target ? fmt(reserves[1]) : fmt(reserves[0]));
    }


    /* arbitrage */

    console.log('\nSending arbitrage request ...');

    const abi = AbiCoder.defaultAbiCoder();
    const pair = await getPairContract(factory, tokens[0].target, tokens[3].target); 
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
