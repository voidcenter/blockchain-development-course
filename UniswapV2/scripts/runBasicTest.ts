import { BasicTestContracts, basicTest, deployBasicTestContracts, 
         deserializeBasicTestContracts, flashloanTest, printBasicTestContracts, 
         serializeBasicTestContracts, verifyBasicTestContracts } 
         from "../test/common/basicTest";
import { getSigners, DEFAULT_HARDHAT_LOCAL_NETWORK_CHAIN_ID } from "../test/common/common";
import { network } from 'hardhat';

const BASIC_TEST_CONTRACTS_ADDRESSES_JSON_FILE = './misc/basicTestContracts.json';


async function main() {
    const signers = await getSigners();

    console.log('owner address = ', signers.owner.address)
    console.log('swapper address = ', signers.swapper!.address)


    const chainIdHex = await network.provider.send('eth_chainId');
    const chainId = parseInt(chainIdHex, 16);
    console.log('chainId = ', chainId);

    
    // If it is local network, run the test E2E  
    if (chainId === DEFAULT_HARDHAT_LOCAL_NETWORK_CHAIN_ID) {
        const contracts = await deployBasicTestContracts(signers);
        printBasicTestContracts(contracts);
        await basicTest(signers, contracts);
        await flashloanTest(signers, contracts);
        return;
    }


    /* 
        Otherwise, give the option for loading previously deployed contracts
        When working with testnet, it could be desirable to load previously deployed contracts
        This is because sometimes deploying on testnet can be costly in terms of gas
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

