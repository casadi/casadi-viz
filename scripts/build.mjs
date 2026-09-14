import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/licenses',{recursive:true});
const common={entryPoints:['src/viewer.js'],bundle:true,loader:{'.css':'text','.html':'text'},minify:true};
await build({...common,format:'esm',outfile:'dist/index.js'});
await build({...common,format:'iife',globalName:'CasadiViz',define:{'import.meta.url':'__casadiVizScriptURL'},banner:{js:'const __casadiVizScriptURL=document.currentScript?.src || document.baseURI;'},outfile:'dist/casadi-viz.global.js'});
await copyFile('src/index.d.ts','dist/index.d.ts');
await copyFile('node_modules/@viz-js/viz/dist/viz-global.js','dist/viz-global.js');
await copyFile('node_modules/@viz-js/viz/lib/provenance.json','dist/licenses/viz-provenance.json');
await copyFile('node_modules/@viz-js/viz/package.json','dist/licenses/viz-package.json');
const js=(await readFile('dist/casadi-viz.global.js','utf8')).replace(/<\/script/gi,'<\\/script');
await writeFile('dist/standalone.html',`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CasADi graph</title>
<style>html,body{height:100%;margin:0}#graph{display:block;height:100%}</style></head><body><div id="graph"></div>
<script id="graph-data" type="application/json">@@GRAPH_DATA@@</script>
<script id="viz-config" type="application/json">@@VIZ_CONFIG@@</script>
<script>${js}</script>
<script>const viewer=CasadiViz.createGraphViewer(document.getElementById('graph'),{runtime:JSON.parse(document.getElementById('viz-config').textContent)});viewer.setGraph(JSON.parse(document.getElementById('graph-data').textContent)).catch(console.error);</script>
</body></html>\n`);
console.log('Built ESM, browser script, renderer and standalone export template');
