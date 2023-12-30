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
