// Read-only verification, then local configuration. Never signs or broadcasts.
// Usage: node product/configure-deployment.mjs <contract-address> <deployment-tx-hash> [--mainnet]
import {readFileSync,writeFileSync} from 'node:fs';
import {JsonRpcProvider} from './dist/vendor/ethers.mjs';
import {NETWORK,TeamPayClient} from './dist/chain.mjs';
import {MAINNET} from './dist/mainnet-deployment.mjs';
const mainnet=process.argv.includes('--mainnet');
const network=mainnet?MAINNET:NETWORK;
const [target,hash]=process.argv.slice(2).filter(arg=>arg!=='--mainnet');
if(!target||!hash){console.error('Usage: node product/configure-deployment.mjs <contract-address> <deployment-tx-hash> [--mainnet]');process.exit(1);}
const artifact=JSON.parse(readFileSync(new URL('dist/contract.json',import.meta.url)));
const provider=new JsonRpcProvider(network.rpcUrls[0]);
try{
 const configuration=await new TeamPayClient(provider,artifact).verifyDeployment(target,hash,BigInt(network.chainId));
 writeFileSync(new URL(mainnet?'dist/mainnet-deployment.json':'dist/deployment.json',import.meta.url),JSON.stringify(configuration,null,2)+'\n');
 console.log(JSON.stringify({verified:true,configuration,next:mainnet?'Mainnet deployment verified. Configure and test the mainnet workspace before activating it publicly.':'Publish this configuration with the site so every visitor uses the shared contract.'},null,2));
}finally{provider.destroy();}
