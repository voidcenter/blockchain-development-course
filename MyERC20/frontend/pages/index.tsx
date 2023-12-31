
import { useEffect, useState } from "react";
import { useAccount, useContractRead } from "wagmi";
import { readContract, waitForTransaction, writeContract } from "wagmi/actions";
import styles from './index.module.css';

const contract_def = require('../public/MyERC20Token.json');
const contract_abi = contract_def.abi;
const MyERC20TokenAddress = "0x5ae8b20195d12da6A5F1ae5d9fFD775464E952bc";

async function myReadContract(func, args) {
    return await readContract({
        address: MyERC20TokenAddress,
        abi: contract_abi,
        functionName: func,
        args,
    });
}

async function myWriteContract(func, args) {
    return await writeContract({
        address: MyERC20TokenAddress,
        abi: contract_abi,
        functionName: func,
        args,
    });
}

function myUseCotnractRead(func, args) {
    return useContractRead({
      address: MyERC20TokenAddress,
      abi: contract_abi,
      functionName: func,
      args
    })
}

const AddressWithLink = ({ address }) => {
    return (
        <a href={`https://sepolia.etherscan.io/address/${address}`} 
           className="underline text-blue-600 pl-1"
           target="_blank">
            {address}
        </a>
    )
}

const Loader = () => <div id="globalLoader">
    <img src="https://upload.wikimedia.org/wikipedia/commons/b/b1/Loading_icon.gif" alt="" />
</div>;


export default function Home() {

    const { address, isConnected } = useAccount();
    const name = myUseCotnractRead('name', []);
    const symbol = myUseCotnractRead('symbol', []);
    const decimals = myUseCotnractRead('decimals', []);
    const totalSupply = myUseCotnractRead('totalSupply', []);
    const myBalance = myUseCotnractRead('balanceOf', [address]);

    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState(0);
    const send = async (recipient, amount) => {
        console.log('sending to ', recipient, amount);
        const tx = await myWriteContract('transfer', [recipient, amount]);
        const receipt = await waitForTransaction(tx);
        receipt.status === 1 ? alert('Success') : alert('Failed');
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-between">
            <div className="fixed top-0 right-0 rounded-full">   
                <w3m-button />
            </div>
            <div className="p-20 content-start self-start">

                <div className="text-sm font-medium text-gray-900">
                    <p>Contract address: <AddressWithLink address={MyERC20TokenAddress}/> </p>
                    {name.data && <p>Token name: {name.data}</p>}
                    {symbol.data && <p>Token symbol: {symbol.data}</p>}
                    {decimals.data && <p>Token decimals: {decimals.data.toLocaleString()}</p>}
                    {totalSupply.data && <p>Token totalSupply: {totalSupply.data.toLocaleString()}</p>}
                </div>

                <div className="text-sm font-medium text-gray-900">
                    {address && <p className="pt-4">My address: <AddressWithLink address={address}/> </p>}
                    {myBalance.data && <p>My balance: {myBalance.data.toLocaleString()}</p>}
                </div>

                <div className="pt-4">
                    {/* <label className="pr-4">Send to:</label> */}
                    {/* <input type="text" className="pt-4 rounded-full h-8 align-middle" /> */}
                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-900">Recipient</label>
                        <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" 
                               onChange={(e) => { setRecipient(e.target.value)}}/>
                    </div>
                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-900">Amount</label>
                        <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" 
                               onChange={(e) => { setAmount(parseInt(e.target.value))}}/>
                    </div>
        
                    <button className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 w-40"
                              onClick={() => { send(recipient, amount); }}>Send</button>
                  {/* <Loader /> */}
                  <div className={styles.cover_spin}/>
                </div>
            </div>
        </main>
    )
}


