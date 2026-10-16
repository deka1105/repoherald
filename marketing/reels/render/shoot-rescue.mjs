import puppeteer from "puppeteer-core";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const facts=JSON.parse(readFileSync("facts.json","utf8"));
mkdirSync("rescue",{recursive:true});
const b=await puppeteer.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless:"new",args:["--force-device-scale-factor=1","--hide-scrollbars","--font-render-hinting=none"]});
const p=await b.newPage();
await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
await p.evaluateOnNewDocument(f=>{window.__FACTS__=f;},facts);
await p.goto("file://"+resolve("frame-rescue.html"),{waitUntil:"networkidle0"});
await p.evaluate(()=>document.fonts.ready);
for(let n=1;n<=8;n++){await p.evaluate(x=>window.renderScene(x),n);
  await p.screenshot({path:`rescue/${n}.png`});}
await b.close();console.log("8 scenes -> rescue/");
