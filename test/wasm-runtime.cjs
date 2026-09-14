const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const create=require(path.resolve(process.argv[2]));const ca=await create();
 for(const X of [ca.SX,ca.MX]) {
   const x=X.sym('x');
   assert.throws(()=>ca.Function('bad',[x],[x],{unknown_option:true}));
   const child=ca.Function('child',[x],[ca.times(x,x)],{never_inline:true});
   const f=ca.Function('f',[x],[child(x)]);
   const bundle=JSON.parse(f.export_graph());
   assert.equal(bundle.format,'casadi_viz');assert.equal(bundle.functions.length,1);
   assert.equal(JSON.parse(f.export_graph({include_functions:false})).functions.length,0);
   assert.equal(JSON.parse(ca.export_graph([x,ca.plus(x,X(1))])).outputs.length,2);
 }
 console.log('WASM constructor options and SX/MX graph-export overloads passed');
})().catch(error=>{console.error(error);process.exit(1)});
