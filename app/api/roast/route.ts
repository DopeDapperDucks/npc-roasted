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
    if(!process.env.OPENAI_API_KEY)return fail("OPENAI_API_KEY has not been configured yet.",503);
    const ip=(req.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();const now=Date.now();const record=LIMIT.get(ip);if(record&&record.until>now&&record.count>=8)return fail("Too many roasts. Try again in an hour.",429);
    LIMIT.set(ip,record&&record.until>now?{...record,count:record.count+1}:{count:1,until:now+3600000});
    // A best-effort in-memory throttle. Replace with a durable shared rate limiter before public launch.
    // Fetch revealed metadata from OpenSea's *metadata* endpoint.
    // The generic Get NFT endpoint can return the old pre-reveal cartridge.
    if (!process.env.OPENSEA_API_KEY) return fail("Set OPENSEA_API_KEY in Vercel to fetch revealed artwork.",503);
    const osURL=`https://api.opensea.io/api/v2/metadata/ethereum/${CONTRACTS[collection]}/${tokenId}`;
    const osResponse=await fetch(osURL,{
      headers:{"x-api-key":process.env.OPENSEA_API_KEY,"accept":"application/json"},
      cache:"no-store",signal:AbortSignal.timeout(15000)
    });
    if(!osResponse.ok){
      console.error("OpenSea metadata lookup failed",{status:osResponse.status,collection,tokenId});
      return fail(osResponse.status===404?"Token metadata not found on OpenSea.":`OpenSea metadata lookup failed (HTTP ${osResponse.status}). Check API access and Vercel logs.`,502);
    }
    const metadata=await osResponse.json();
    const normalizeUrl=(value:unknown):string|null=>{
      if(typeof value!=="string"||!value.trim())return null;
      if(value.startsWith("ipfs://"))return `https://ipfs.io/ipfs/${value.replace(/^ipfs:\/\/(?:ipfs\/)?/,"")}`;
      if(value.startsWith("ar://"))return `https://arweave.net/${value.slice(5)}`;
      return publicHttps(value)?value:null;
    };
    // Intentionally ONLY use the metadata.image property. No cartridge-prone fallback.
    const candidates=[...new Set([metadata.image].map(normalizeUrl).filter((u):u is string=>!!u))];
    if(!candidates.length)return fail("OpenSea metadata did not return a usable revealed image URL.",422);
    console.info("OpenSea metadata artwork selected",{collection,tokenId,imageHost:new URL(candidates[0]).hostname,imagePath:new URL(candidates[0]).pathname});
    let dataUrl:string|null=null;
    for(const url of candidates){
      try{
        const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(15000),redirect:"error",headers:{accept:"image/*"}});
        if(!response.ok)continue;
        if(Number(response.headers.get("content-length")||0)>12_000_000)continue;
        const bytes=Buffer.from(await response.arrayBuffer());
        if(!bytes.length||bytes.length>12_000_000)continue;
        const png=await sharp(bytes,{limitInputPixels:25_000_000,animated:false}).rotate().resize({width:1024,height:1024,fit:"inside",withoutEnlargement:true}).png().toBuffer();
        if(png.length>8_000_000)continue;
        dataUrl=`data:image/png;base64,${png.toString("base64")}`;
        break;
      }catch(e){console.warn("OpenSea artwork candidate failed",{host:new URL(url).hostname,error:e instanceof Error?e.message:"unknown"});}
    }
    if(!dataUrl)return fail("OpenSea image could not be downloaded or converted. See Vercel Logs.",422);
    const traits=Array.isArray(metadata.traits)?metadata.traits:[];
    const prompt=`You are the comedian behind NPC ROASTED, a silly roast site for illustrated NFT characters. Examine the ACTUAL ATTACHED ARTWORK first. Target the CHARACTER's visible clothes, accessories, expression, pose, colors and combinations of traits. Mention at least TWO specific, visually verified details in the roast. Do not invent features. Use traits only as supporting context, never as proof of visual details. This is fictional lighthearted character comedy, not an attack on the owner. Avoid slurs, protected-class attacks, sexual content, violent threats, appearance/body-shaming of real people, or generic crypto/trading jokes. Roast level: ${level}. ${level==="Mild"?"Gentle, silly teasing.":level==="Spicy"?"Sharp, punchy, surprising joke.":"Savage absurd comedy without hateful or personally abusive content."} Return ONLY valid JSON with keys headline (2-5 words), roast (ONE punchy sentence of 10-16 words, no filler or setup; prefer a sharp visual punchline and no extra clauses), traitsSeen (array of 2-4 genuinely visible traits), stats (array of exactly 4 objects with label and value, short, absurd and based on visible artwork). Avoid claiming knowledge of the character's real identity. NFT metadata trait hints: ${JSON.stringify(traits).slice(0,2000)}.`;
    const ai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:dataUrl}]}],text:{format:{type:"json_schema",name:"npc_roast",strict:true,schema:{type:"object",additionalProperties:false,properties:{headline:{type:"string"},roast:{type:"string"},traitsSeen:{type:"array",items:{type:"string"}},stats:{type:"array",items:{type:"object",additionalProperties:false,properties:{label:{type:"string"},value:{type:"string"}},required:["label","value"]}}},required:["headline","roast","traitsSeen","stats"]}}},max_output_tokens:500}),signal:AbortSignal.timeout(45000)});
    if(!ai.ok){console.error("OpenAI response status",ai.status);return fail("AI roast generation failed. Check server logs and API billing.",502);}
    const completion=await ai.json();const content=(completion.output||[]).flatMap((o:{content?:Array<{type:string,text?:string}>})=>o.content||[]).find((x:{type:string})=>x.type==="output_text")?.text;
    if(!content)return fail("No roast returned. Please retry.",502);
    const generated=JSON.parse(content);
    if(!generated.roast||!Array.isArray(generated.stats))return fail("Invalid roast response. Please retry.",502);
    return NextResponse.json({tokenId,collection,imageDataUrl:dataUrl,roast:generated.roast,headline:generated.headline,traitsSeen:generated.traitsSeen,stats:generated.stats.slice(0,4)});
  } catch(e) {console.error("Roast request failed",e);return fail("Something went wrong retrieving or roasting the NFT.",500);}
}
