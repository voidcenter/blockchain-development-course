# ERC-20 Sample Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat compile
npx hardhat test
REPORT_GAS=true npx hardhat test
```

Deploy contract:

`yarn deploy`

Monitor events:

`yarn monitor`

Test contract:

`yarn test`

Dispaly opcode: 

```
pip install pyevmasm
echo -n "608060405260043610603f57600035" | evmasm -d
```

Verify contract ([reference](https://hardhat.org/hardhat-runner/docs/guides/verifying)):

```
npx hardhat verify --network sepolia 0x5ae8b20195d12da6A5F1ae5d9fFD775464E952bc "My ERC20 Token" "MY20" 18 1000
```

