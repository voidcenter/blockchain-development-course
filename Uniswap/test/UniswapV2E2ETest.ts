// import { AbiCoder } from "ethers";
// import { ethers } from "hardhat";
// const { expect } = require("chai");


// interface TestContext {
//     owner: any;
//     swapper: any;
//     token0: any;
//     token1: any;
//     factory: any;
//     pair: any;
//     router: any;
//     decimals: bigint;
//     decimalsMultipler: bigint;
//     formatBigintAmount: (x: bigint) => string;
// }


// async function createTestContext(): Promise<TestContext> {
//     console.log("\n\n");

//     const [owner, swapper] = await ethers.getSigners();
//     console.log('owner address = ', owner.address)
//     console.log('swapper address = ', swapper.address)

//     console.log('\n** deploy contracts **');

//     // create token0 and token1
//     const decimals = 18n;
//     const formatBigintAmount = (x: bigint) => {
//         const decimalsMultipler = 10n**decimals;
//         return `${(Number(x) / Number(decimalsMultipler)).toFixed(2)}`;
//     }

//     const decimalsMultipler = 10n**decimals;
//     const token0 = await ethers.deployContract("MyERC20TokenOZ", ["Token0", "T0", 18, 10000n * decimalsMultipler]);
//     const token1 = await ethers.deployContract("MyERC20TokenOZ", ["Token1", "T1", 18, 10000n * decimalsMultipler]);

//     expect(await token0.totalSupply()).to.equal(await token0.balanceOf(owner.address));
//     expect(await token1.totalSupply()).to.equal(await token1.balanceOf(owner.address));
//     console.log('token0 = ', token0.target);
//     console.log('token1 = ', token1.target);

//     // create factory
//     const factory = await ethers.deployContract("UniswapV2Factory", []);
//     expect(await factory.allPairsLength()).to.equal(0);
//     console.log('factory = ', factory.target);

//     // create pair
//     // console.log(token0);
//     await factory.createPair(token0.target, token1.target);        
//     const pairAddress = await factory.getPair(token0.target, token1.target);
//     const UniswapV2PairFactory = await ethers.getContractFactory("UniswapV2Pair");
//     const pair = await UniswapV2PairFactory.attach(pairAddress) as any;

//     console.log('pair = ', pairAddress);
//     console.log('pair: symbol = ', await pair.symbol(), ', token0 = ', await pair.token0(), ', token1 = ', await pair.token1(), 
//                 ', reserves = ', await pair.getReserves()); 

//     // create router 
//     const router = await ethers.deployContract("UniswapV2Router02", [factory.target]);

//     return {
//         owner,
//         swapper,
//         token0,
//         token1,
//         factory,
//         pair,
//         router,
//         decimals,
//         decimalsMultipler,
//         formatBigintAmount
//     };
// }


// async function interactWithUniswap(context: TestContext) {

//     const { owner, swapper, token0, token1, pair, router, decimals, decimalsMultipler, formatBigintAmount } = context;

//     // add liquidity
//     console.log('\n** add liquidity **');
//     const time_in_the_future = Date.now() + 1000000000;
//     const stakeAmount = 1000n * decimalsMultipler;
//     await token0.approve(router.target, stakeAmount);
//     await token1.approve(router.target, stakeAmount);
//     await router.addLiquidity(token0.target, token1.target, stakeAmount, stakeAmount, 0, 0, owner.address, time_in_the_future);
    
//     expect(await pair.decimals()).to.equal(decimals);
//     let liquidity = await pair.balanceOf(owner.address);
//     let reserves = await pair.getReserves();
//     expect(liquidity).to.be.above(0);
//     expect(reserves[0]).to.equal(stakeAmount);
//     expect(reserves[1]).to.equal(stakeAmount);
//     console.log('liquidity added = ', formatBigintAmount(liquidity)); 
//     console.log('pair reserves = ', formatBigintAmount(reserves[0]), formatBigintAmount(reserves[1])); 


//     // swap
//     console.log('\n** swap **');
//     const token0AmountIn = 100n * decimalsMultipler;
//     await token0.transfer(swapper.address, token0AmountIn);   //transfer 100 token0 to swapper
//     await token0.connect(swapper).approve(router.target, token0AmountIn);  // swapper allows the router to spend 100 token0
//     await router.connect(swapper)
//         .swapExactTokensForTokens(token0AmountIn, 0, [token0.target, token1.target], swapper.address, time_in_the_future);

//     reserves = await pair.getReserves();
//     let token1AmountOut = await token1.balanceOf(swapper.address);
//     console.log('swapper swapped ', formatBigintAmount(token0AmountIn), 
//                 'token0 for', formatBigintAmount(token1AmountOut), 'token1');
//     expect(token1AmountOut).to.be.above(0);
//     expect(reserves[0]).to.equal(stakeAmount + token0AmountIn);
//     expect(reserves[1]).to.equal(stakeAmount - token1AmountOut);


//     // remove liquidity
//     console.log('\n** remove liquidity **');
//     await pair.approve(router.target, liquidity);
//     await router.removeLiquidity(token0.target, token1.target, liquidity, 0, 0, owner.address, time_in_the_future);

//     reserves = await pair.getReserves();
//     console.log('reserve0 = ', formatBigintAmount(reserves[0]), ', reserve1 = ', formatBigintAmount(reserves[1]));
//     console.log('reserves = ', reserves);
//     expect(reserves[0]).to.be.above(0);
//     expect(reserves[1]).to.be.above(0);

//     console.log('pair supply = ', await pair.totalSupply());
//     expect(await pair.totalSupply()).to.equal(1000n);   // permanently locked liquidity
// }


// async function testFlashloan(context: TestContext) {

//     const { owner, token0, token1, factory, pair, router, decimalsMultipler, formatBigintAmount } = context;

//     const time_in_the_future = Date.now() + 1000000000;
//     const stakeAmount = 1000n * decimalsMultipler;
//     await token0.approve(router.target, stakeAmount);
//     await token1.approve(router.target, stakeAmount);
//     await router.addLiquidity(token0.target, token1.target, stakeAmount, stakeAmount, 0, 0, owner.address, time_in_the_future);

//     // flashloan
//     console.log('\n** flashloan **');

//     // create testing flashloaner
//     const flashloaner = await ethers.deployContract("MyFlashloaner", []);
//     await token0.transfer(flashloaner.target, stakeAmount);   //transfer 1000 token0 to flashloaner

//     /*
//         We are demonstrating flashloan here with over-repayment. This means that we borrow 1000 tokens and later repay
//         1004 tokens. This is not profitable but the point is to demonstrate that we can borrow without collateral.
//         In practical use, we would use these borrowed 1000 tokens to trade for a profit, like end up with 1100 tokens, 
//         then we issue the repayment of 1004 tokens, and keep the 96 tokens as profit.

//         For this test, because the owner has sent some token0 to the flashloaner in advance, it can afford to repay 
//         a little more than what it borrowed.
//     */

//     // flashloan, note that we are calling the pair directly
//     const abi = AbiCoder.defaultAbiCoder();
//     await pair.swap(
//         stakeAmount / 2n,        // only borrow token0
//         0,
//         flashloaner.target,
//         abi.encode(['uint'], [123n])
//       )    
// }


// describe("E2E Test", function () {
//     // it("E2E test should succeed", async function () {
//     //     const context = await createTestContext();
//     //     await interactWithUniswap(context);        
//     // });
//     it("Flashloan test should succeed", async function () {
//         const context = await createTestContext();
//         await testFlashloan(context);        
//     });
// });
