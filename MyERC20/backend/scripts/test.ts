import { ethers } from "hardhat";

async function main() {
    const contractAddress = "0x69798f4ACcc0aA70739F90115196b26732cd3278";

    const TokeContact = await ethers.getContractFactory("MyERC20Token");
    const contract = await TokeContact.attach(contractAddress) as any;

    // read basic info
    console.log("Contract name:", await contract.name());
    console.log("Contract symbol:", await contract.symbol());
    console.log("Contract decimals:", await contract.decimals());
    console.log("Contract totalSupply:", await contract.totalSupply());
    
    const [owner] = await ethers.getSigners();
    console.log("Contract owner:", owner.address);
    console.log("Contract balanceOf:", await contract.balanceOf(owner.address));


    // test approve
    const spender = "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2";

    let tx;
    console.log(`Allowance (${owner.address}, ${spender}):`, await contract.allowance(owner.address, spender));

    tx = await contract.approve(spender, 100000);
    const reci = await tx.wait();
    console.log(`Allowance (${owner.address}, ${spender}):`, await contract.allowance(owner.address, spender));
    // console.log("txn receipt:", reci);

    tx = await contract.approve(spender, 0);
    await tx.wait();
    console.log(`Allowance (${owner.address}, ${spender}):`, await contract.allowance(owner.address, spender));


    // test transfer 
    const recipient = "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4";

    console.log(`balanceOf(${recipient}):`, await contract.balanceOf(recipient));
    console.log(`balanceOf(${owner.address}):`, await contract.balanceOf(owner.address));
    await (await contract.transfer(recipient, 10)).wait();
    console.log(`balanceOf(${recipient}):`, await contract.balanceOf(recipient));
    console.log(`balanceOf(${owner.address}):`, await contract.balanceOf(owner.address));

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});

