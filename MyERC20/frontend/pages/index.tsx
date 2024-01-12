
import { useEffect, useState } from "react";
import { useAccount, useContractRead, useWaitForTransaction } from "wagmi";
import { readContract, waitForTransaction, watchContractEvent, writeContract } from "wagmi/actions";

const contract_def = require('../public/MyERC20Token.json');
const contract_abi = contract_def.abi;
const MyERC20TokenAddress = "0xA1BBD8B6493C32A3C27cCDef182b46d3441d9Bc3";

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

function my_watch_contract_event (eventName: string, callback: (args: any) => void): any {
  return watchContractEvent(
      {
        address: MyERC20TokenAddress,
        abi: contract_abi,
        eventName
      },
      (logs) => {
          const log: any = logs[0];
          callback(log.args);
      }
  );
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

const TxHashWithLink = ({ txHash }) => {
  return (
      <a href={`https://sepolia.etherscan.io/tx/${txHash}`} 
         className="underline text-blue-600 pl-1"
         target="_blank">
          {txHash}
      </a>
  )
}

const TxStatus = ({ status, txHash }) => {
    if (status === 'pending') { 
        return <p>Tx <TxHashWithLink txHash={txHash}/> Pending ...</p>;
    } 
    if (status === 'success') { 
        return <p>Tx <TxHashWithLink txHash={txHash}/> Succeeded!</p>;
    }
    return <p>Tx <TxHashWithLink txHash={txHash}/>  <span className="text-red-600">{status}</span></p>;
}


export default function Home() {

    const { address, isConnected } = useAccount();
    // console.log('address', address);

    // useEffect(() => {
    //     const run = async () => {
    //         console.log('name', await myReadContract('name', []));
    //         console.log('symbol', await myReadContract('symbol', []));
    //         console.log('decimals', await myReadContract('decimals', []));
    //         console.log('totalSupply', await myReadContract('totalSupply', []));
    //         console.log('balanceOf', await myReadContract('balanceOf', [address]));
    //     };
    //     run();
    // });

    useEffect(() => {
        const unwatch_events = my_watch_contract_event('Transfer', async (args) => {
            console.log('Transfer event', args);
        });
        return () => {
            console.log('unwatch_events');
            unwatch_events();
        };
    })

    const name = myUseCotnractRead('name', []);
    const symbol = myUseCotnractRead('symbol', []);
    const decimals = myUseCotnractRead('decimals', []);
    const totalSupply = myUseCotnractRead('totalSupply', []);
    const myBalance = myUseCotnractRead('balanceOf', [address]);

    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState(0);
    const [txStatus, setTxStatus] = useState(null);
    const [txHash, setTxHash] = useState(null);

    const send = async (recipient, amount) => {

        // Check if a pervious transaction is pending
        if (txStatus === 'pending') {
            console.log('already pending');
            return;
        }
        console.log('sending to ', recipient, amount);

        // Send transaction
        const tx = await myWriteContract('transfer', [recipient, amount])
            .catch(error => {
                console.log('error', error);
             });

        // Check if tx was sent
        if (!tx) {
            setTxStatus('failed');
            return;
        }

        // Wait for transaction to be mined
        const receipt = await waitForTransaction(tx);
        console.log('transaction receipt', receipt);

        // Update tx status
        setTxHash(tx.hash);
        setTxStatus('pending');

        // Wait for transaction to be mined
        // const receipt = await waitForTransaction(tx);
        setTxStatus(receipt.status);

        // Update balance
        myBalance.refetch();
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
                    {decimals.status === 'success' && <p>Token decimals: {decimals.data.toLocaleString()}</p>}
                    {totalSupply.status === 'success' && <p>Token totalSupply: {totalSupply.data.toLocaleString()}</p>}
                </div>

                <div className="text-sm font-medium text-gray-900">
                    {address && <p className="pt-4">My address: <AddressWithLink address={address}/> </p>}
                    {myBalance.status === 'success' && <p>My balance: {myBalance.data.toLocaleString()}</p>}
                </div>

                <div className="pt-4">
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
        
                    <div className="mb-6">                     
                        <button className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 w-40"
                                  onClick={() => { send(recipient, amount); }}>Send</button>
                    </div>

                    <div className="mb-6 text-sm font-medium text-gray-900">                     
                        {txStatus && <TxStatus status={txStatus} txHash={txHash} />}
                    </div>
                </div>
            </div>
        </main>
    )
}

