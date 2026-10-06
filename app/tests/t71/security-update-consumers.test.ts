import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const workspace = resolve(import.meta.dirname, "../..");
const web = createRequire(resolve(workspace, "apps/web/package.json"));
const mobile = createRequire(resolve(workspace, "apps/mobile/package.json"));
const root = createRequire(resolve(workspace, "package.json"));
const next = createRequire(web.resolve("next/package.json"));
const nextPostcss = createRequire(next.resolve("postcss"));
const tailwind = createRequire(web.resolve("@tailwindcss/postcss"));
const tailwindNode = createRequire(tailwind.resolve("@tailwindcss/node"));
const expo = createRequire(mobile.resolve("expo/package.json"));
const expoMetro = createRequire(expo.resolve("@expo/metro-config"));
const expoPostcss = createRequire(expoMetro.resolve("postcss"));
const vitest = createRequire(root.resolve("vitest/package.json"));
const vite = createRequire(vitest.resolve("vite"));
const vitePostcss = createRequire(vite.resolve("postcss"));
const expoCli = createRequire(expo.resolve("@expo/cli"));
const sourceConsumers = [
  ["Next PostCSS", nextPostcss],
  ["Tailwind", tailwindNode],
  ["Expo Metro PostCSS", expoPostcss],
  ["Vite PostCSS", vitePostcss],
] as const;
const sourceEntry = nextPostcss.resolve("source-map-js");
const compressionEntry = expoCli.resolve("compression");

// Child processes bound CPU/resource regressions, isolate zlib instrumentation,
// and exercise CSP without changing another test worker's global state.
function runChild(code: string, args: string[], flags: string[] = []) {
  const child = spawnSync(process.execPath, [...flags, "-e", code, ...args], {
    cwd: workspace,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 65536,
    windowsHide: true,
    env: {
      NODE_ENV: "test",
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
      ...(process.env.TMP ? { TMP: process.env.TMP } : {}),
    },
  });
  expect(
    child.error,
    "bounded child must finish without a timeout",
  ).toBeUndefined();
  expect(child.status, child.stderr).toBe(0);
  return child.stdout;
}

const mappingCompatibility = String.raw`
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const sourceRequire = createRequire(process.argv[1]);
assert.equal(sourceRequire('./package.json').version, '1.2.2');
const {SourceMapGenerator,SourceMapConsumer,SourceNode} = sourceRequire(process.argv[1]);
const generator = new SourceMapGenerator({file:'output.css'});
generator.addMapping({generated:{line:1,column:0},original:{line:1,column:0},source:'източник.css'});
generator.setSourceContent('източник.css', '.карта { color: red; }');
const flat = generator.toJSON();
const consumer = new SourceMapConsumer(flat);
assert.equal(consumer.originalPositionFor({line:1,column:0}).source, 'източник.css');
assert.equal(consumer.sourceContentFor('източник.css'), '.карта { color: red; }');
const flatRoundtrip = new SourceMapConsumer(SourceMapGenerator.fromSourceMap(consumer).toString());
assert.equal(flatRoundtrip.originalPositionFor({line:1,column:0}).source,'източник.css');
const indexedMap = {version:3,sections:[{offset:{line:2,column:0},map:flat}]};
const indexed = new SourceMapConsumer(indexedMap);
const mappings=[]; indexed.eachMapping(mapping=>mappings.push(mapping));
assert.equal(mappings.length,1); assert.equal(mappings[0].generatedLine,3);
const flattened = new SourceMapGenerator({file:'output.css'});
indexed.eachMapping(mapping=>flattened.addMapping({
  generated:{line:mapping.generatedLine,column:mapping.generatedColumn},
  original:{line:mapping.originalLine,column:mapping.originalColumn},source:mapping.source,
}));
flattened.setSourceContent('източник.css',consumer.sourceContentFor('източник.css'));
const flattenedRoundtrip = new SourceMapConsumer(flattened.toString());
assert.equal(flattenedRoundtrip.originalPositionFor({line:3,column:1}).source,'източник.css');
assert.equal(flattenedRoundtrip.sourceContentFor('източник.css'),'.карта { color: red; }');
// Indexed consumers do not expose a sourceRoot compatible with the generator's
// legacy fromSourceMap helper. Preserve indexed JSON and use its public lookup.
const roundtrip = new SourceMapConsumer(JSON.stringify(indexedMap));
assert.equal(roundtrip.originalPositionFor({line:3,column:1}).source,'източник.css');
const code='first\nsecond\n.карта { color: red; }\n';
assert.equal(SourceNode.fromStringWithSourceMap(code,indexed).toStringWithSourceMap({file:'output.css'}).code,code);
console.log('MAP_ROUNDTRIP_OK');
`;

describe("reviewed source-map-js installed consumers", () => {
  it.each(sourceConsumers)(
    "preserves flat/indexed roundtrips through %s",
    (_, consumer) => {
      expect(
        runChild(mappingCompatibility, [consumer.resolve("source-map-js")]),
      ).toContain("MAP_ROUNDTRIP_OK");
    },
  );

  it("retains actual Next PostCSS CSS and external source-map content", () => {
    const result = runChild(
      String.raw`
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const postcssRequire=createRequire(process.argv[1]);
const source=postcssRequire('source-map-js');
assert.equal(postcssRequire('source-map-js/package.json').version,'1.2.2');
const css='.карта { color: red; }';
postcssRequire(process.argv[1])().process(css,{from:'input.css',to:'output.css',map:{inline:false,annotation:false}}).then(result=>{
  assert.equal(result.css,css); assert.ok(result.map);
  const map=new source.SourceMapConsumer(result.map.toJSON());
  assert.equal(map.originalPositionFor({line:1,column:0}).source,'input.css');
  assert.equal(map.sourceContentFor('input.css'),css);
  console.log('POSTCSS_OK');
}).catch(error=>{console.error(error);process.exitCode=1;});
`,
      [next.resolve("postcss")],
    );
    expect(result).toContain("POSTCSS_OK");
  });

  it("rejects invalid/oversized indexed offsets and their nested aggregate within a deadline", () => {
    const result = runChild(
      String.raw`
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const loaded=createRequire(process.argv[1]);
assert.equal(loaded('./package.json').version,'1.2.2');
const {SourceMapConsumer,SourceNode}=loaded(process.argv[1]);
const flat={version:3,sources:['input.css'],names:[],mappings:'AAAA',sourcesContent:['x\n']};
const indexed=(line,column=0,map=flat)=>({version:3,sections:[{offset:{line,column},map}]});
for(const line of [-1,0.5,NaN,Infinity,1e9])assert.throws(()=>new SourceMapConsumer(indexed(line)),/Section offset/);
for(const column of [-1,0.5,NaN,Infinity])assert.throws(()=>new SourceMapConsumer(indexed(0,column)),/Section offset/);
assert.throws(()=>new SourceMapConsumer(indexed(6000000,0,indexed(6000000))),/including offsets of nested sections/);
// A mapping may legitimately point beyond the supplied code; do not iterate
// through a million absent code lines before discovering that code is exhausted.
const distant=new SourceMapConsumer(indexed(1000000));
assert.equal(SourceNode.fromStringWithSourceMap('x\n',distant).toString(),'x\n');
console.log('INDEXED_BOUNDS_OK');
`,
      [sourceEntry],
    );
    expect(result).toContain("INDEXED_BOUNDS_OK");
  });

  it("sorts real source-map mappings when CSP forbids string code generation", () => {
    const result = runChild(
      String.raw`
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const loaded=createRequire(process.argv[1]);
assert.equal(loaded('./package.json').version,'1.2.2');
assert.throws(()=>new Function('return 0'),EvalError);
const {SourceMapGenerator,SourceMapConsumer}=loaded(process.argv[1]);
const generator=new SourceMapGenerator();
for(let line=40;line>0;line--)generator.addMapping({generated:{line,column:0},original:{line,column:0},source:'input.css'});
const consumer=new SourceMapConsumer(generator.toString());
const lines=[]; consumer.eachMapping(mapping=>lines.push(mapping.generatedLine));
assert.deepEqual(lines,Array.from({length:40},(_,i)=>i+1));
assert.equal(consumer.originalPositionFor({line:40,column:0}).line,40);
console.log('CSP_SORT_OK');
`,
      [sourceEntry],
      ["--disallow-code-generation-from-strings"],
    );
    expect(result).toContain("CSP_SORT_OK");
  });
});

const compressionCompatibility = String.raw`
const assert=require('node:assert/strict');
const http=require('node:http');
const zlib=require('node:zlib');
const {createRequire}=require('node:module');
const loaded=createRequire(process.argv[1]);
assert.equal(loaded('./package.json').version,'1.8.2');
const compression=loaded(process.argv[1]);
const mode=process.argv[2],payload=Buffer.from('София 🚗 '.repeat(2048));
const descriptor=Object.getOwnPropertyDescriptor(zlib,'createGzip');
const streams=[];
Object.defineProperty(zlib,'createGzip',{...descriptor,value:function(...args){
  const stream=descriptor.value.apply(this,args); streams.push(stream); return stream;
}});
const middleware=compression({threshold:0});
let serverFailure,closedResolve;
const responseClosed=new Promise(resolve=>{closedResolve=resolve;});
const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  if(req.url==='/no-transform')res.setHeader('Cache-Control','NO-TRANSFORM');
  middleware(req,res,()=>{
    if(mode==='early'){
      res.once('close',()=>{
        try{res.write(payload);res.end();}catch(error){serverFailure=error;}
        setImmediate(closedResolve);
      });
      res.destroy();
    }else if(mode==='abort'){
      const timer=setInterval(()=>{res.write(payload);res.flush();},10);
      res.once('close',()=>{clearInterval(timer);setImmediate(closedResolve);});
    }else res.end(payload);
  });
});
async function exchange(path){
  return new Promise((resolve,reject)=>{
    const req=http.get({hostname:'127.0.0.1',port:server.address().port,path,headers:{'Accept-Encoding':'gzip'}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
      res.on('end',()=>resolve({headers:res.headers,body:Buffer.concat(chunks)}));
    });req.on('error',reject);
  });
}
async function main(){
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    if(mode==='normal'){
      const compressed=await exchange('/');
      assert.equal(compressed.headers['content-encoding'],'gzip');
      assert.deepEqual(zlib.gunzipSync(compressed.body),payload);
      const transformed=await exchange('/no-transform');
      assert.equal(transformed.headers['content-encoding'],undefined);
      assert.deepEqual(transformed.body,payload);
      assert.equal(streams.length,1);
    }else{
      const req=http.get({hostname:'127.0.0.1',port:server.address().port,path:'/',headers:{'Accept-Encoding':'gzip'}},res=>{
        res.on('error',()=>{});
        if(mode==='abort')res.once('data',()=>{res.destroy();req.destroy();});
      });
      req.on('error',error=>{if(!['ECONNRESET','ERR_STREAM_DESTROYED'].includes(error.code))serverFailure=error;});
      await responseClosed;
      if(serverFailure)throw serverFailure;
      assert.equal(streams.length,1);
      // Observe the actual stream after middleware cleanup, not a source marker.
      const stream=streams[0];
      for(let i=0;i<40&&!stream.closed;i++)await new Promise(resolve=>setTimeout(resolve,5));
      assert.equal(stream.closed,true,'native gzip stream must close');
    }
    console.log('COMPRESSION_'+mode.toUpperCase()+'_OK');
  }finally{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    Object.defineProperty(zlib,'createGzip',descriptor);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
`;

describe("reviewed compression through Expo CLI's installed middleware", () => {
  it.each(["normal", "abort", "early"])(
    "preserves response semantics and stream cleanup: %s",
    (mode) => {
      expect(
        runChild(compressionCompatibility, [compressionEntry, mode]),
      ).toContain(`COMPRESSION_${mode.toUpperCase()}_OK`);
    },
  );
});
