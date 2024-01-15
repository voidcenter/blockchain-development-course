import { arbitrageTest, deployArbitrageTestContracts, deserializeArbitrageTestContracts, 
         printArbitrageTestContracts, serializeArbitrageTestContracts, verifyArbitrageTestContracts } 
         from "../test/common/arbitrageTest";
import { getSigners, DEFAULT_HARDHAT_LOCAL_NETWORK_CHAIN_ID } from "../test/common/common";
import { network } from 'hardhat';
         
const ARBITRAGE_TEST_CONTRACTS_ADDRESSES_JSON_FILE = './misc/arbitrageTestContracts.json';


async function main() {
    const signers = await getSigners();

    console.log('owner address = ', signers.owner.address)
    console.log('swapper address = ', signers.swapper!.address)


    const chainIdHex = await network.provider.send('eth_chainId');
    const chainId = parseInt(chainIdHex, 16);
    console.log('chainId = ', chainId);


    // If it is local network, run the test E2E  
    if (chainId === DEFAULT_HARDHAT_LOCAL_NETWORK_CHAIN_ID) {
        const contracts = await deployArbitrageTestContracts(signers);
        printArbitrageTestContracts(contracts);
        await arbitrageTest(signers, contracts);
        return;
    }
    

    /* 
        Otherwise, give the option for loading previously deployed contracts
        When working with testnet, it could be desirable to load previously deployed contracts
        This is because sometimes deploying on testnet can be costly in terms of gas
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

