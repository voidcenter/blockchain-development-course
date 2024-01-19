import { arbitrageTest, deployArbitrageTestContracts, printArbitrageTestContracts } from "./common/arbitrageTest";
import { getSigners } from "./common/common";


describe("Arbitrage Test", function () {
    it("Arbitrage test should succeed", async function () {
        const signers = await getSigners();
        const contracts = await deployArbitrageTestContracts(signers, true);
        printArbitrageTestContracts(contracts);
        await arbitrageTest(signers, contracts, true);
    });
});


