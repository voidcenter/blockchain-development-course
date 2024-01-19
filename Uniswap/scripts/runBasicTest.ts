import { BasicTestContracts, basicTest, deployBasicTestContracts, 
         deserializeBasicTestContracts, flashloanTest, printBasicTestContracts, 
         serializeBasicTestContracts, verifyBasicTestContracts } 
         from "../test/common/basicTest";
import { getSigners } from "../test/common/common";

const BASIC_TEST_CONTRACTS_ADDRESSES_JSON_FILE = './misc/basicTestContracts.json';


async function main() {
    const signers = await getSigners();

    console.log('owner address = ', signers.owner.address)
    console.log('swapper address = ', signers.swapper!.address)

    /* You should only do this occasionally because it costs a lot of gas. 
       You can serialize the addresses to a file and load them later.
    */

    // const contracts = await deployBasicTestContracts(signers);
    // printBasicTestContracts(contracts);
    // serializeBasicTestContracts(contracts, BASIC_TEST_CONTRACTS_ADDRESSES_JSON_FILE);

    const contracts = await deserializeBasicTestContracts(BASIC_TEST_CONTRACTS_ADDRESSES_JSON_FILE);
    // await verifyBasicTestContracts(contracts);

    printBasicTestContracts(contracts);
    await basicTest(signers, contracts);
    await flashloanTest(signers, contracts);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

