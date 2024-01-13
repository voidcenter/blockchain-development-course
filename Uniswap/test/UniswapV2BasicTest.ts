import { AbiCoder } from "ethers";
import { ethers } from "hardhat";
import { BasicTestContracts, deployBasicTestContracts, basicTest, printContext, basicTestContracts_localTestCheck, basicTest, printBasicTestContracts } from "./common/BasicTest";
import { getSigners } from "./common/common";
const { expect } = require("chai");


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
//     const pairToken0Address = await pair.token0();
//     const pairToken0 = token0.target == pairToken0Address ? token0 : token1;
//     await pairToken0.transfer(flashloaner.target, stakeAmount);   //transfer 1000 token0 to flashloaner

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


describe("E2E Test", function () {
    it("Basic test should succeed", async function () {
        const signers = await getSigners();
        // console.log('owner address = ', signers.owner.address)
        // console.log('swapper address = ', signers.swapper!.address)
    
        const contracts = await deployBasicTestContracts(signers, true);
        printBasicTestContracts(contracts);
        await basicTest(signers, contracts, true);
    });
    // it("Flashloan test should succeed", async function () {
    //     const context = await createTestContext();
    //     await testFlashloan(context);        
    // });
});
