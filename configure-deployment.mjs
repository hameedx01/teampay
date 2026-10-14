// Read-only verification, then local configuration. Never signs or broadcasts.
// Usage: node product/configure-deployment.mjs <contract-address> <deployment-tx-hash>
import {readFileSync,writeFileSync} from 'node:fs';
import {JsonRpcProvider} from './dist/vendor/ethers.mjs';
import {NETWORK,TeamPayClient} from './dist/chain.mjs';
const [target,hash]=process.argv.slice(2);
if(!target||!hash){console.error('Usage: node product/configure-deployment.mjs <contract-address> <deployment-tx-hash>');process.exit(1);}
const artifact=JSON.parse(readFileSync(new URL('dist/contract.json',import.meta.url)));
const provider=new JsonRpcProvider(NETWORK.rpcUrls[0]);
try{
 const configuration=await new TeamPayClient(provider,artifact).verifyDeployment(target,hash,BigInt(NETWORK.chainId));
 writeFileSync(new URL('dist/deployment.json',import.meta.url),JSON.stringify(configuration,null,2)+'\n');
 console.log(JSON.stringify({verified:true,configuration,next:'Publish this configuration with the site so every visitor uses the shared contract.'},null,2));
}finally{provider.destroy();}
