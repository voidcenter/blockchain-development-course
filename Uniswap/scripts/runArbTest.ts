import { arbitrageTest, deployArbitrageTestContracts, deserializeArbitrageTestContracts, 
         printArbitrageTestContracts, serializeArbitrageTestContracts, verifyArbitrageTestContracts } 
         from "../test/common/arbitrageTest";
import { getSigners } from "../test/common/common";

const ARBITRAGE_TEST_CONTRACTS_ADDRESSES_JSON_FILE = './misc/arbitrageTestContracts.json';


async function main() {
    const signers = await getSigners();

    console.log('owner address = ', signers.owner.address)
    console.log('swapper address = ', signers.swapper!.address)

    /* You should only do this occasionally because it costs a lot of gas. 
    You can serialize the addresses to a file and load them later.
    */

    // const contracts = await deployArbitrageTestContracts(signers);
    // printArbitrageTestContracts(contracts);
    // serializeArbitrageTestContracts(contracts, ARBITRAGE_TEST_CONTRACTS_ADDRESSES_JSON_FILE);

    const contracts = await deserializeArbitrageTestContracts(ARBITRAGE_TEST_CONTRACTS_ADDRESSES_JSON_FILE);
    // await verifyArbitrageTestContracts(contracts);

    printArbitrageTestContracts(contracts);
    await arbitrageTest(signers, contracts);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

