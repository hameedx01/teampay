import {ContractFactory,getAddress,getCreateAddress} from './vendor/ethers.mjs';
export const MAINNET={chainId:'0x13b2',chainName:'Arc Mainnet',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:['https://rpc.blockdaemon.mainnet.arc.io'],blockExplorerUrls:['https://explorer.arc.io']};
export const DEPLOYMENT_FEE_CAP=100000000000000000n;
export async function prepareDeployment(provider,artifact,raw){
 const account=getAddress(raw);
 if((await provider.getNetwork()).chainId!==5042n)throw new Error('Deployment requires Arc Mainnet, chain 5042.');
 const block=await provider.getBlock('latest');if(!block||Math.abs(Date.now()/1000-block.timestamp)>120)throw new Error('The RPC is stale. Try again later.');
 const tx=await new ContractFactory(artifact.abi,artifact.bytecode).getDeployTransaction();
 const [gas,fees,balance,nonce]=await Promise.all([provider.estimateGas({...tx,from:account}),provider.getFeeData(),provider.getBalance(account),provider.getTransactionCount(account,'pending')]);
 const gasLimit=(gas*120n+99n)/100n,price=(fees.gasPrice??fees.maxFeePerGas);if(!price||price<=0n)throw new Error('Network fee estimate unavailable.');
 const feePerGas=price*2n,maxFee=gasLimit*feePerGas;
 if(maxFee>DEPLOYMENT_FEE_CAP)throw new Error('Deployment exceeds the 0.10 USDC fee cap. No transaction prepared.');
 if(balance<maxFee)throw new Error('Not enough mainnet USDC for the maximum deployment fee.');
 const transaction={...tx,from:account,chainId:5042n,nonce,gasLimit,value:0n};
 if(fees.maxFeePerGas){transaction.maxFeePerGas=feePerGas;transaction.maxPriorityFeePerGas=fees.maxPriorityFeePerGas??0n;}else transaction.gasPrice=feePerGas;
 return {account,transaction,maxFee,balance,predictedAddress:getCreateAddress({from:account,nonce}),preparedAt:Date.now()};
}
export async function verifyDeploymentReview(provider,walletProvider,plan){
 if(Date.now()-plan.preparedAt>120000)throw new Error('Fee review expired. Estimate again before deploying.');
 const accounts=await walletProvider.request({method:'eth_accounts'});
 if(accounts[0]?.toLowerCase()!==plan.account.toLowerCase()||BigInt(await walletProvider.request({method:'eth_chainId'}))!==5042n)throw new Error('Wallet account or network changed. Estimate again.');
 if((await provider.getNetwork()).chainId!==5042n)throw new Error('RPC network changed.');
 if(await provider.getTransactionCount(plan.account,'pending')!==plan.transaction.nonce)throw new Error('Another wallet transaction changed the nonce. Estimate again.');
 if(await provider.getBalance(plan.account)<plan.maxFee)throw new Error('Wallet balance changed. Estimate again.');
}
