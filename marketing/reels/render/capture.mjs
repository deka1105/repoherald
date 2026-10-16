import puppeteer from "puppeteer-core";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FPS=30, DUR=32, W=1080, H=1920;
const facts=JSON.parse(readFileSync("facts.json","utf8"));
const mode=process.argv[2]||"full";
const outDir=mode==="sample"?"stills":"frames";
mkdirSync(outDir,{recursive:true});

const browser=await puppeteer.launch({executablePath:CHROME,headless:"new",
  args:["--force-device-scale-factor=1","--hide-scrollbars","--font-render-hinting=none"]});
const page=await browser.newPage();
await page.setViewport({width:W,height:H,deviceScaleFactor:1});
// Facts injected before the page script runs, so a frame can never show a
// number that was typed rather than read out of the repo.
await page.evaluateOnNewDocument(f=>{window.__FACTS__=f;},facts);
await page.goto("file://"+resolve("frame.html"),{waitUntil:"networkidle0"});
await page.evaluate(()=>document.fonts.ready);

const times = mode==="sample"
  // one settled frame per scene, plus four mid-transition frames
  ? [1.2,3.6,6.2,8.8,11.0,12.0,15.0,16.6,20.0,22.0,25.2,26.4,27.6,29.4,31.4, 4.7,13.7,17.9,28.5]
  : Array.from({length:DUR*FPS},(_,i)=>i/FPS);

let n=0;
for(const t of times){
  await page.evaluate(x=>window.renderFrame(x),t);
  const name = mode==="sample" ? `t${t.toFixed(2)}.png` : String(n).padStart(5,"0")+".png";
  await page.screenshot({path:`${outDir}/${name}`});
  if(++n%120===0) process.stdout.write(`  ${n}/${times.length}\n`);
}
await browser.close();
console.log(`captured ${n} -> ${outDir}/`);
