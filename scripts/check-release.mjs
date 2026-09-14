import {readFile} from 'node:fs/promises';
const {name,version}=JSON.parse(await readFile('package.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
if(name!=='@casadi/casadi-viz')throw Error('Unexpected package name: '+name);
if(process.env.RELEASE_TAG!=='v'+version)throw Error('Release tag must match package.json: v'+version);
if(lock.version!==version || lock.packages[''].version!==version)throw Error('Update package-lock.json version too');
if(version.includes('-')!==(process.env.RELEASE_PRERELEASE==='true')) {
  throw Error('GitHub prerelease flag must match the package version');
}
console.log('Release metadata matches '+name+'@'+version);
