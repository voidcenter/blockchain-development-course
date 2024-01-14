const { expect } = require("chai");
import * as fs from 'fs';

import { AbiCoder } from "ethers";
import { ethers } from "hardhat";
import { UniswapV2Pair } from "../../typechain-types/UniswapV2Pair";
import { UniswapV2Factory } from "../../typechain-types/UniswapV2Factory";
import { ArbitrageTest, MyERC20TokenOZ } from "../../typechain-types";
import { UniswapV2Router02 } from "../../typechain-types/UniswapV2Router02";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DECIMALS, DECIMALS_MULTIPLIER, Signers, TEST_TOKEN_INITIAL_SUPPLY, deployTx, getPairContract, getPairContractFromAddress, verifyContract } from "./common";
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
                
                tokenA, tokens[1] is tokenB
                // they are different from the token0 and token1 in a pair
                // if token[0] < token[1] lexically, 
                //     then pair token0 = token[0] = tokenA, pair token1 = token[1] = tokenB
                // If token[0] > token[1] lexically, 
                //     then pair token0 = token[1] = tokenB, pair token1 = token[0] = tokenA
    [0, 2],
    [1, 2],
    [0, 3]
];


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
        const tokenChar = String.fromCharCode(65 + i);  // 'A', 'B', 'C', 'D' ...
        console.log(`Deploying token${tokenChar} ...`);
        tokens.push(await deployTx(ethers.deployContract
            ("MyERC20TokenOZ", [`Token${tokenChar}`, `T${tokenChar}`, DECIMALS, TEST_TOKEN_INITIAL_SUPPLY])));
    }

    console.log('Deploying factory contract ...');
    const factory = await deployTx(ethers.deployContract("UniswapV2Factory", []));

    console.log('Deploying router contract ...');    
    const router = await deployTx(ethers.deployContract("UniswapV2Router02", [factory.target]));


    // create pairs. pairs[0][3] stores the pair of t0, t3. note that pairs[0][3] == pairs[3][0]
    console.log('Creating testing pairs ...');    
    const UniswapV2PairFactory = await ethers.getContractFactory("UniswapV2Pair");

    // creating pairs
    const pairs: UniswapV2Pair[] = [];
    for (let pairInd = 0; pairInd < PairTokenIndices.length; pairInd++) {
        const [i, j] = PairTokenIndices[pairInd];


        const pairs = await Promise.all(PairTokenIndices.map(async ([i, j]) => {
        await factory.createPair(tokens[i].target, tokens[j].target);
        return await getPairContract(factory, tokens[i].target as string, tokens[j].target as string);
    }));


    // Deploy arbitrageur
    console.log('Deploying arbitraguer contract ...');    
    const arbitrageur = await ethers.deployContract("ArbitrageTest", [factory.target, router.target]);


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

    await Promise.all([
        ... tokens.map((token, i) => {
            const tokenChar = String.fromCharCode(65 + i);  
            const initArgsStr = `"Token${tokenChar}" "T${tokenChar}" ${DECIMALS.toString()} ${TEST_TOKEN_INITIAL_SUPPLY.toString()}`;
            verifyContract(token.target as string, initArgsStr);
        }), 
        verifyContract(factory.target as string, ''),
        ... pairs.map(pair => verifyContract(pair.target as string, '')),
        verifyContract(router.target as string, contracts.factory.target as string),
        verifyContract(arbitrageur.target as string, 
            `${factory.target} ${router.target}`),
    ]);
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
    const maxStakeAmount = 10000n * DECIMALS_MULTIPLIER;

    console.log('\n** tokens **');
    tokens.forEach((token, i) => {
        const tokenChar = String.fromCharCode(65 + i);  
        console.log(`token${tokenChar} = `, token.target);
    });

    pairs.forEach(async (pair, i) => {
        const [tokenA, tokenB] = PairTokenIndices[i];
        const tokenAChar = String.fromCharCode(65 + tokenA);  
        const tokenBChar = String.fromCharCode(65 + tokenB);  
        console.log(`pair[${i}] trades token${tokenAChar} and token${tokenBChar}], `,
                    'token 0 = ', await pair.token0(), 'token1 = ', await pair.token1());
    });


    /*
        we set up the following prices reflecting market inefficiency:

        t0, t1:   1000, 2000        (1 t0 = 2 t1)
        t1, t2:   1500, 1000        (3 t1 = 2 t2)
        t0, t2:   1000, 1000        (1 t0 = 1 t2)

        this way, 300 t0 -> 600 t1 -> 400 t2 -> 400 t0 is a profitable triangle trade.

        we then have a pair:

        t0, t3:   2000, 2000        for liquidity borrowing. We don't trade in this pair, 
                                    just use it as a source to fund the trade through flashloan.

    */


    /* staking liquidity */

    console.log('\nStaking liquidity to the pairs ...');
    tokens.map(async (token) => {
        await token.approve(router.target, maxStakeAmount);
    });

    await router.addLiquidity(tokens[0].target, tokens[1].target, 1000n * DECIMALS_MULTIPLIER, 2000n * DECIMALS_MULTIPLIER, 
        0, 0, owner.address, time_in_the_future);
    await router.addLiquidity(tokens[1].target, tokens[2].target, 1500n * DECIMALS_MULTIPLIER, 1000n * DECIMALS_MULTIPLIER, 
        0, 0, owner.address, time_in_the_future);
    await router.addLiquidity(tokens[0].target, tokens[2].target, 1000n * DECIMALS_MULTIPLIER, 1000n * DECIMALS_MULTIPLIER, 
        0, 0, owner.address, time_in_the_future);
                
    await router.addLiquidity(tokens[0].target, tokens[3].target, 2000n * DECIMALS_MULTIPLIER, 2000n * DECIMALS_MULTIPLIER, 
        0, 0, owner.address, time_in_the_future);


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
    await pair.swap(
        amount0Out,
        amount1Out,
        arbitrageur.target,
        abi.encode(['address[]'], [ [tokens[0].target, tokens[1].target, tokens[2].target, tokens[0].target] ])
    )    
    const afterBalance = await tokens[0].balanceOf(arbitrageur.target);

    // expect to be profitable
    if (localTest) {
        expect(afterBalance).to.be.above(beforeBalance);
    }
}
