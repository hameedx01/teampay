export function walletErrorCode(error){return error?.rpcCode??error?.data?.originalError?.code??error?.info?.error?.code??error?.code;}
export const PENDING_MESSAGE='A connection request is already open in your wallet. Open the wallet extension and approve or cancel it, then check the connection below.';
export class AccountConnection {
 constructor(provider){this.provider=provider;this.inFlight=null;this.pending=false;}
 async check(){const accounts=await this.provider.request({method:'eth_accounts'});if(accounts.length)this.pending=false;return accounts;}
 connect(){
  if(this.inFlight)return this.inFlight;
  this.inFlight=(async()=>{
   const existing=await this.check();if(existing.length)return existing;
   if(this.pending)throw Object.assign(new Error(PENDING_MESSAGE),{code:-32002});
   try{return await this.provider.request({method:'eth_requestAccounts'});}catch(error){
    if(Number(walletErrorCode(error))===-32002){this.pending=true;throw Object.assign(new Error(PENDING_MESSAGE),{code:-32002});}
    throw error;
   }
  })().finally(()=>{this.inFlight=null;});
  return this.inFlight;
 }
 resetAfterCancellation(){this.pending=false;}
}

export async function walletSnapshot(provider,targetChain){
 const [accounts,chainId]=await Promise.all([provider.request({method:'eth_accounts'}),provider.request({method:'eth_chainId'})]);
 return {account:accounts[0]||null,chainId,wrongNetwork:accounts.length>0&&BigInt(chainId)!==BigInt(targetChain)};
}
export class NetworkConnection {
 constructor(provider,network){this.provider=provider;this.network=network;this.inFlight=null;}
 switch(){
  if(this.inFlight)return this.inFlight;
  this.inFlight=(async()=>{
   const request=(method,params)=>this.provider.request({method,params});
   if(BigInt(await request('eth_chainId'))===BigInt(this.network.chainId))return;
   try{await request('wallet_switchEthereumChain',[{chainId:this.network.chainId}]);}
   catch(error){if(Number(walletErrorCode(error))!==4902)throw error;await request('wallet_addEthereumChain',[this.network]);
    if(BigInt(await request('eth_chainId'))!==BigInt(this.network.chainId))await request('wallet_switchEthereumChain',[{chainId:this.network.chainId}]);
   }
   if(BigInt(await request('eth_chainId'))!==BigInt(this.network.chainId))throw new Error('Your wallet is still on another network. Switch to Arc Testnet to continue.');
  })().finally(()=>{this.inFlight=null;});return this.inFlight;
 }
}
