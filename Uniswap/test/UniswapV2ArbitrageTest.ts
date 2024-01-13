// import { AbiCoder } from "ethers";
// import { ethers } from "hardhat";
// import { UniswapV2Pair } from "../typechain-types/UniswapV2Pair";
// import { UniswapV2Factory } from "../typechain-types/UniswapV2Factory";
// import { MyERC20TokenOZ } from "../typechain-types";
// import { UniswapV2Router02 } from "../typechain-types/UniswapV2Router02";
// import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
// const { expect } = require("chai");


// /*

//     This is a test to demonstrate using flashloan to arbitrage. The test setup has four tokens and four token pairs:

//     t0, t1
//     t0, t2
//     t1, t2
//     t0, t3

//     We assume that the triangle t0, t1, t2 has market inefficiency such that there is arbitrage opportunity.
//     The flashloaner borrows t0 from the t0, t3 pair and use that to trade in the t0, t1, t2 triangle.
//     Some of the profit is paid as fee to the t0, t3 pair and the rest is kept as profit.

//     In a practical setting, an off-chain program would be used to identify such arbitrage opportunity and to 
//     calculate the optimal amount to borrow and trade.

//     In a practical setting, frontrunning should be considered.

// */


// const PairIndices = [
//     [0, 1],
//     [0, 2],
//     [1, 2],
//     [0, 3]
// ];


// interface TestContext {
//     owner: HardhatEthersSigner;
//     tokens: MyERC20TokenOZ[];
//     factory: UniswapV2Factory;
//     pairs: UniswapV2Pair[][];
//     router: UniswapV2Router02;
//     decimals: bigint;
//     decimalsMultipler: bigint;
//     formatBigintAmount: (x: bigint) => string;
// }


// async function createTestContext(): Promise<TestContext> {
//     console.log("\n\n");

//     const [owner] = await ethers.getSigners();
//     console.log('owner address = ', owner.address)

//     console.log('\n** deploy contracts **');

//     // create token0 and token1
//     const decimals = 18n;
//     const formatBigintAmount = (x: bigint) => {
//         const decimalsMultipler = 10n**decimals;
//         return `${(Number(x) / Number(decimalsMultipler)).toFixed(2)}`;
//     }

//     const decimalsMultipler = 10n**decimals;

//     /*
//         the following line is a shorthand for creating 4 tokens:

//             const token0 = await ethers.deployContract("MyERC20TokenOZ", ["Token0", "T0", 18, 10000n * decimalsMultipler]);
//             const token1 = await ethers.deployContract("MyERC20TokenOZ", ["Token1", "T1", 18, 10000n * decimalsMultipler]);
//             const token2 = await ethers.deployContract("MyERC20TokenOZ", ["Token2", "T2", 18, 10000n * decimalsMultipler]);
//             const token3 = await ethers.deployContract("MyERC20TokenOZ", ["Token3", "T3", 18, 10000n * decimalsMultipler]);

//     */
//     const tokens = await Promise.all([...Array(4).keys()].map(async (i) => {
//         const token = await ethers.deployContract("MyERC20TokenOZ", [`Token${i}`, `T${i}`, 18, 10000n * decimalsMultipler]);
//         expect(await token.totalSupply()).to.equal(await token.balanceOf(owner.address));
//         console.log(`token${i} = `, token.target);
//         return token;
//     }));

//     // create factory
//     const factory = await ethers.deployContract("UniswapV2Factory", []);
//     expect(await factory.allPairsLength()).to.equal(0);
//     console.log('factory = ', factory.target);

//     // create pairs
//     // pair array, pairs[0][3] stores the pair of t0, t3. note that pairs[0][3] == pairs[3][0]
//     const pairs: UniswapV2Pair[][] = [...Array(4)].map(e => Array(4));
//     const UniswapV2PairFactory = await ethers.getContractFactory("UniswapV2Pair");
//     PairIndices.forEach(async ([i, j]) => {
//         await factory.createPair(tokens[i].target, tokens[j].target);
//         const pairAddress = await factory.getPair(tokens[i].target, tokens[j].target);
//         const pair = await UniswapV2PairFactory.attach(pairAddress) as any;
//         pairs[i][j] = pair;
//         pairs[j][i] = pair;
//         console.log(`pair[${i}][${j}] = `, pairAddress);
//     });

//     // create router 
//     const router = await ethers.deployContract("UniswapV2Router02", [factory.target]);

//     return {
//         owner,
//         tokens,
//         factory,
//         pairs,
//         router,
//         decimals,
//         decimalsMultipler,
//         formatBigintAmount
//     };
// }


// async function testArbitrage(context: TestContext) {

//     const { owner, tokens, pairs, factory, router, decimalsMultipler, formatBigintAmount } = context;

//     const time_in_the_future = Date.now() + 1000000000;
//     const maxStakeAmount = 10000n * decimalsMultipler;
//     tokens.map(async (token) => {
//         await token.approve(router.target, maxStakeAmount);
//     });

//     /*
//         we set up the following prices reflecting market inefficiency:

//         t0, t1:   1000, 2000        (1 t0 = 2 t1)
//         t1, t2:   1500, 1000        (3 t1 = 2 t2)
//         t0, t2:   1000, 1000        (1 t0 = 1 t2)

//         this way, 300 t0 -> 600 t1 -> 400 t2 -> 400 t0 is a profitable triangle trade.

//         we then have a pair:

//         t0, t3:   2000, 2000        for liquidity borrowing. We don't trade in this pair, 
//                                     just use it as a source to fund the trade through flashloan.

//     */

//     // add liquidity`
//     await router.addLiquidity(tokens[0].target, tokens[1].target, 1000n * decimalsMultipler, 2000n * decimalsMultipler, 
//         0, 0, owner.address, time_in_the_future);
//     await router.addLiquidity(tokens[1].target, tokens[2].target, 1500n * decimalsMultipler, 1000n * decimalsMultipler, 
//         0, 0, owner.address, time_in_the_future);
//     await router.addLiquidity(tokens[0].target, tokens[2].target, 1000n * decimalsMultipler, 1000n * decimalsMultipler, 
//         0, 0, owner.address, time_in_the_future);
                
//     await router.addLiquidity(tokens[0].target, tokens[3].target, 2000n * decimalsMultipler, 2000n * decimalsMultipler, 
//         0, 0, owner.address, time_in_the_future);


//     // arbitrage
//     console.log('\n** arbitrage **');
//     const arbitrageur = await ethers.deployContract("ArbitrageTest", [factory.target, router.target]);

//     const abi = AbiCoder.defaultAbiCoder();
//     const pair03Token0 = await pairs[0][3].token0();
//     const pair03Token1 = await pairs[0][3].token1();
//     console.log('pairs[0][3] token0 = ', pair03Token0, 'token1 = ', pair03Token1);
//     // set amount0/1Out according to whether token0 is token0 in the pair
//     // nnote that the two tokens are ordered lexigraphically in the pair
//     const borrowAmount = 50n * decimalsMultipler;
//     const amount0Out = tokens[0].target === pair03Token0 ? borrowAmount : 0n;
//     const amount1Out = tokens[0].target === pair03Token0 ? 0n : borrowAmount;
//     await pairs[0][3].swap(
//         amount0Out,
//         amount1Out,
//         arbitrageur.target,
//         abi.encode(['address[]'], [ [tokens[0].target, tokens[1].target, tokens[2].target, tokens[0].target] ])
//       )    
// }


// describe("Arbitrage Test", function () {
//     it("Flashloan test should succeed", async function () {
//         const context = await createTestContext();
//         await testArbitrage(context);        
//     });
// });

