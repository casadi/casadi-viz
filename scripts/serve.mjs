import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.casadi_viz':'application/json','.wasm':'application/wasm','.so':'application/wasm'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    let name=decodeURIComponent(url.pathname);
    if(name==='/'){res.writeHead(302,{Location:'/examples/index.html'});res.end();return;}
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep))throw Error('Invalid path');
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT||8766),'127.0.0.1',()=>console.log('CasADi viz prototypes: http://127.0.0.1:'+server.address().port));
