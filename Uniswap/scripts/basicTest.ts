import { ethers } from "hardhat";
import { BasicTestContracts, deployBasicTestContracts, basicTest, printContext } from "../test/common/BasicTest";


async function main() {
    const [owner, swapper] = await ethers.getSigners();

    console.log('owner address = ', owner.address)
    console.log('swapper address = ', swapper.address)

    const context = await deployBasicTestContracts(owner, swapper);
    printContext(context);
    await basicTest(context);        

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

