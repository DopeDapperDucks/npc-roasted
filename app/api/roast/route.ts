import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
export const runtime = "nodejs";
const CONTRACTS: Record<string,string> = {
  npc: "0xa2a6063b910fc7a7a286196f6c9b62b2797fa0ae",
  pc: "0xe7d97e9e47ad0640f92f43f204e5fcce2ce8b20e"
};
const LIMIT = new Map<string,{count:number,until:number}>();
function fail(error:string,status:number){return NextResponse.json({error},{status});}
function publicHttps(u:string){try{const url=new URL(u);const host=url.hostname.toLowerCase();return url.protocol==="https:" && host!=="localhost" && !host.endsWith(".localhost") && !host.endsWith(".local") && !host.endsWith(".internal") && !/^\d+\.\d+\.\d+\.\d+$/.test(host) && !host.includes(":");}catch{return false;}}
export async function POST(req:NextRequest){
  try {
    const body=await req.json(); const tokenId=String(body.tokenId||"");
    const collection=String(body.collection||"");const level=String(body.level||"");
    if(!/^\d{1,30}$/.test(tokenId)||!CONTRACTS[collection]||!["Mild","Spicy","Absolutely Cooked"].includes(level))return fail("Enter a valid token ID, collection and roast level.",400);
    if(!process.env.ALCHEMY_API_KEY||!process.env.OPENAI_API_KEY)return fail("Server API keys have not been configured yet.",503);
    const ip=(req.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();const now=Date.now();const record=LIMIT.get(ip);if(record&&record.until>now&&record.count>=8)return fail("Too many roasts. Try again in an hour.",429);
    LIMIT.set(ip,record&&record.until>now?{...record,count:record.count+1}:{count:1,until:now+3600000});
    // A best-effort in-memory throttle. Replace with a durable shared rate limiter before public launch.
    const metaURL=new URL(`https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}/getNFTMetadata`);
    metaURL.searchParams.set("contractAddress",CONTRACTS[collection]);metaURL.searchParams.set("tokenId",tokenId);
    metaURL.searchParams.set("refreshCache","true");
    const m=await fetch(metaURL,{cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(!m.ok)return fail(m.status===404?"Token not found.":"NFT lookup failed. Please try again.",502);
    const nft=await m.json();
    if(nft.contract?.address && nft.contract.address.toLowerCase()!==CONTRACTS[collection].toLowerCase())return fail("NFT provider returned the wrong collection.",502);
    if(nft.tokenId && BigInt(nft.tokenId).toString()!==BigInt(tokenId).toString())return fail("NFT provider returned a different token ID.",502);
    const traits=Array.isArray(nft.raw?.metadata?.attributes)?nft.raw.metadata.attributes:[];
    // Alchemy can return missing conversions or raw IPFS/GIF/SVG artwork.
    const normalizeUrl=(value:unknown):string|null=>{
      if(typeof value!=="string" || !value.trim())return null;
      if(value.startsWith("ipfs://")){
        const path=value.replace(/^ipfs:\/\/(?:ipfs\/)?/,"");
        return `https://ipfs.io/ipfs/${path}`;
      }
      if(value.startsWith("ar://"))return `https://arweave.net/${value.slice(5)}`;
      return publicHttps(value)?value:null;
    };
    // Prefer revealed metadata artwork, not Alchemy's potentially stale cached thumbnail.
    const rawCandidates=[nft.raw?.metadata?.image,nft.raw?.metadata?.image_url,nft.image?.originalUrl,nft.image?.pngUrl,nft.image?.cachedUrl,nft.image?.thumbnailUrl];
    const candidates=[...new Set(rawCandidates.map(normalizeUrl).filter((u):u is string=>!!u))];
    if(!candidates.length)return fail("No image URL was returned by Alchemy for this token.",422);
    console.info("NPC artwork sources",{collection,tokenId,sourceHosts:candidates.map(u=>new URL(u).hostname)});
    let dataUrl:string|null=null;
    for(const url of candidates){
      try{
        const imgRes=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:"error",headers:{"Accept":"image/*"}});
        if(!imgRes.ok)continue;
        const declaredSize=Number(imgRes.headers.get("content-length")||0);
        if(declaredSize>12_000_000)continue;
        const bytes=Buffer.from(await imgRes.arrayBuffer());
        if(!bytes.length||bytes.length>12_000_000)continue;
        const png=await sharp(bytes,{limitInputPixels:25_000_000,animated:false})
          .rotate().resize({width:1024,height:1024,fit:"inside",withoutEnlargement:true})
          .png().toBuffer();
        if(png.length>8_000_000)continue;
        dataUrl=`data:image/png;base64,${png.toString("base64")}`;
        break;
      }catch(e){console.warn("Artwork candidate failed:",new URL(url).hostname,e instanceof Error?e.message:"unknown error");}
    }
    if(!dataUrl)return fail("Alchemy returned artwork links, but none could be downloaded and converted. Check Vercel logs for Artwork candidate failed.",422);
    const prompt=`You are the comedian behind NPC ROASTED, a silly roast site for illustrated NFT characters. Examine the ACTUAL ATTACHED ARTWORK first. Target the CHARACTER's visible clothes, accessories, expression, pose, colors and combinations of traits. Mention at least TWO specific, visually verified details in the roast. Do not invent features. Use traits only as supporting context, never as proof of visual details. This is fictional lighthearted character comedy, not an attack on the owner. Avoid slurs, protected-class attacks, sexual content, violent threats, appearance/body-shaming of real people, or generic crypto/trading jokes. Roast level: ${level}. ${level==="Mild"?"Gentle, silly teasing.":level==="Spicy"?"Sharp, punchy, surprising joke.":"Savage absurd comedy without hateful or personally abusive content."} Return ONLY valid JSON with keys headline (2-5 words), roast (one or two punchy sentences, 12-40 words), traitsSeen (array of 2-4 genuinely visible traits), stats (array of exactly 4 objects with label and value, short and funny). Avoid claiming knowledge of the character's real identity. NFT metadata trait hints: ${JSON.stringify(traits).slice(0,2000)}.`;
    const ai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:dataUrl}]}],text:{format:{type:"json_schema",name:"npc_roast",strict:true,schema:{type:"object",additionalProperties:false,properties:{headline:{type:"string"},roast:{type:"string"},traitsSeen:{type:"array",items:{type:"string"}},stats:{type:"array",items:{type:"object",additionalProperties:false,properties:{label:{type:"string"},value:{type:"string"}},required:["label","value"]}}},required:["headline","roast","traitsSeen","stats"]}}},max_output_tokens:500}),signal:AbortSignal.timeout(45000)});
    if(!ai.ok){console.error("OpenAI response status",ai.status);return fail("AI roast generation failed. Check server logs and API billing.",502);}
    const completion=await ai.json();const content=(completion.output||[]).flatMap((o:{content?:Array<{type:string,text?:string}>})=>o.content||[]).find((x:{type:string})=>x.type==="output_text")?.text;
    if(!content)return fail("No roast returned. Please retry.",502);
    const generated=JSON.parse(content);
    if(!generated.roast||!Array.isArray(generated.stats))return fail("Invalid roast response. Please retry.",502);
    return NextResponse.json({tokenId,collection,imageDataUrl:dataUrl,roast:generated.roast,headline:generated.headline,traitsSeen:generated.traitsSeen,stats:generated.stats.slice(0,4)});
  } catch(e) {console.error("Roast request failed",e);return fail("Something went wrong retrieving or roasting the NFT.",500);}
}
