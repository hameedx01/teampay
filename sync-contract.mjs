// Rebuild browser ABI/bytecode and publish the matching contract source with the site repo.
// The repository includes the Foundry project in feasibility/.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./feasibility/',import.meta.url));
const result=spawnSync('forge',['build'],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
const artifact=JSON.parse(readFileSync(root+'/out/TeamPay.sol/TeamPay.json'));
writeFileSync(new URL('dist/contract.json',import.meta.url),JSON.stringify({abi:artifact.abi,bytecode:artifact.bytecode.object,runtime:artifact.deployedBytecode.object}));
mkdirSync(new URL('contracts/',import.meta.url),{recursive:true});
for(const name of ['TeamPay','ProjectPayments'])copyFileSync(root+'/src/'+name+'.sol',new URL('contracts/'+name+'.sol',import.meta.url));
