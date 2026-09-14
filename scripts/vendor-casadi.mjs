import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const casadi=process.argv[2];
if(!casadi)throw Error('Usage: node scripts/vendor-casadi.mjs /path/to/casadi-worktree');
const template=await readFile('dist/standalone.html');
const pkg=JSON.parse(await readFile('package.json','utf8'));
await copyFile('dist/standalone.html',path.join(casadi,'casadi/core/graph_viewer.html'));
await writeFile(path.join(casadi,'casadi/core/graph_viewer.version.json'),JSON.stringify({
  package:pkg.name,version:pkg.version,repository:pkg.repository.url,
  template_sha256:createHash('sha256').update(template).digest('hex')
},null,2)+'\n');
console.log('Updated CasADi vendored viewer template and provenance');
