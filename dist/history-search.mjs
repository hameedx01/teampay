// Search bounded pages, stopping at a payment or the contract's first block.
export async function searchPaymentHistory(client,address,id,{toBlock,minBlock=0,maxPages=6,hasPayments=true,onProgress=()=>{},isCurrent=()=>true}={}){
 let end=toBlock,firstEnd,page;
 for(let n=0;n<maxPages;n++){
  if(!isCurrent())return null;
  page=await client.paymentHistory(address,id,{toBlock:end,minBlock});
  if(!isCurrent())return null;
  firstEnd??=page.toBlock;onProgress({fromBlock:page.fromBlock,toBlock:firstEnd,pages:n+1});
  if(page.payments.length||page.earlierBlock===null||!hasPayments)return {...page,toBlock:firstEnd};
  end=page.earlierBlock;
 }
 return {...page,toBlock:firstEnd};
}
