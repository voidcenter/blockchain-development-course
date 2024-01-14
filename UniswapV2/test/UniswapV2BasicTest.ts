import { deployBasicTestContracts, basicTest, printBasicTestContracts, flashloanTest } from "./common/basicTest";
import { getSigners } from "./common/common";


describe("E2E Test", function () {

    it("Basic test should succeed", async function () {
        const signers = await getSigners();
        // console.log('owner address = ', signers.owner.address)
        // console.log('swapper address = ', signers.swapper!.address)
    
        const contracts = await deployBasicTestContracts(signers, true);
        printBasicTestContracts(contracts);
        await basicTest(signers, contracts, true);
    });

    it("Flashloan test should succeed", async function () {
        const signers = await getSigners();
        const contracts = await deployBasicTestContracts(signers, true);
        printBasicTestContracts(contracts);
        await flashloanTest(signers, contracts, true);
    });
});
