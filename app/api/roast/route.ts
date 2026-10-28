import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { checkRoastLimit } from "../../../lib/roast-guard";
export const runtime = "nodejs";
const CONTRACTS: Record<string,string> = {
  npc: "0xa2a6063b910fc7a7a286196f6c9b62b2797fa0ae",
  pc: "0xe7d97e9e47ad0640f92f43f204e5fcce2ce8b20e"
};
function fail(error:string,status:number){return NextResponse.json({error},{status});}
function publicHttps(u:string){try{const url=new URL(u);const host=url.hostname.toLowerCase();return url.protocol==="https:" && host!=="localhost" && !host.endsWith(".localhost") && !host.endsWith(".local") && !host.endsWith(".internal") && !/^\d+\.\d+\.\d+\.\d+$/.test(host) && !host.includes(":");}catch{return false;}}
export async function POST(req:NextRequest){
  try {
    if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return fail("Send a JSON request.",415);
    // Enforce the actual streamed body size, even without Content-Length.
    const reader=req.body?.getReader();if(!reader)return fail("Send a JSON request.",400);
    let size=0;const chunks:Uint8Array[]=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();return fail("Request is too large.",413);}chunks.push(value);}}finally{reader.releaseLock();}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{return fail("Send valid JSON.",400);}
    if(!body||typeof body!=="object"||Array.isArray(body))return fail("Send a JSON object.",400);
    const tokenId=String(body.tokenId||"");
    const collection=String(body.collection||"");const level=String(body.level||"");
    if(!/^\d{1,30}$/.test(tokenId)||!Object.hasOwn(CONTRACTS,collection)||!["Mild","Spicy","Absolutely Cooked"].includes(level))return fail("Enter a valid token ID, collection and roast level.",400);
    if(!process.env.OPENAI_API_KEY)return fail("OPENAI_API_KEY has not been configured yet.",503);
    // Fetch revealed metadata from OpenSea's *metadata* endpoint.
    // The generic Get NFT endpoint can return the old pre-reveal cartridge.
    if (!process.env.OPENSEA_API_KEY) return fail("Set OPENSEA_API_KEY in Vercel to fetch revealed artwork.",503);
    const blocked=await checkRoastLimit(req.headers);
    if(blocked)return NextResponse.json({error:blocked.error},{status:blocked.status,headers:{"Retry-After":String(blocked.retryAfter),"Cache-Control":"no-store"}});
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
    const prompt=`You are a sharp comedy writer for NPC ROASTED. This is a roast of a fictional ILLUSTRATED NFT character, not the owner. LOOK AT THE ATTACHED IMAGE. Write one genuinely funny, instantly understandable, spoken-out-loud roast: 8-15 words, ideally one clean punchline. Base it on 1-2 SPECIFIC, VISIBLE traits that interact in a funny way. It should sound like a quick clever comeback, not AI trying to be witty. Avoid setup phrases, generic crypto jokes, clunky metaphors, dated references, filler, explaining the joke, and random unrelated imagery. Prefer a visual observation with an unexpected but natural payoff. Examples of cadence only (do not reuse): "Those 3D glasses can't give your personality any depth."; "That haircut looks like it lost a fight with a ceiling fan." Avoid repeated jokes when asked to roast again. Never invent unseen traits or insult real people or protected traits. Level: ${level} (${level==="Mild"?"warm and teasing":level==="Spicy"?"sharp and cheeky":"extra savage but playful"}). Headline: 2-4 concise words. Generate exactly four playful stat boxes, each based on a visible trait. Each stat has a SHORT label, SHORT funny value, and an integer score from 0 to 100 (the score is an entirely fictional comic rating, not a factual evaluation). Also output cookedLevel: integer from 0 to 100, representing how hard the character was roasted; it is a fictional entertainment score. Write distinct jokes, not identity claims. Return JSON only. Metadata hint, not evidence: ${JSON.stringify(traits).slice(0,1500)}.`;
    const ai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:dataUrl}]}],text:{format:{type:"json_schema",name:"npc_roast",strict:true,schema:{type:"object",additionalProperties:false,properties:{headline:{type:"string"},roast:{type:"string"},traitsSeen:{type:"array",items:{type:"string"}},cookedLevel:{type:"integer"},stats:{type:"array",items:{type:"object",additionalProperties:false,properties:{label:{type:"string"},value:{type:"string"},score:{type:"integer"}},required:["label","value","score"]}}},required:["headline","roast","traitsSeen","stats","cookedLevel"]}}},max_output_tokens:500}),signal:AbortSignal.timeout(45000)});
    if(!ai.ok){console.error("OpenAI response status",ai.status);return fail("AI roast generation failed. Check server logs and API billing.",502);}
    const completion=await ai.json();const content=(completion.output||[]).flatMap((o:{content?:Array<{type:string,text?:string}>})=>o.content||[]).find((x:{type:string})=>x.type==="output_text")?.text;
    if(!content)return fail("No roast returned. Please retry.",502);
    const generated=JSON.parse(content);
    if(!generated.roast||!Array.isArray(generated.stats))return fail("Invalid roast response. Please retry.",502);
    return NextResponse.json({tokenId,collection,imageDataUrl:dataUrl,roast:generated.roast,headline:generated.headline,traitsSeen:generated.traitsSeen,stats:generated.stats.slice(0,4).map((s:{label:string;value:string;score:number})=>({...s,score:Math.max(0,Math.min(100,Math.round(Number(s.score)||0)))})),cookedLevel:Math.max(0,Math.min(100,Math.round(Number(generated.cookedLevel)||0)))});
  } catch(e) {console.error("Roast request failed",e);return fail("Something went wrong retrieving or roasting the NFT.",500);}
}
