import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const pkg=JSON.parse(readFileSync(resolve(root,"package.json"),"utf8"));
const run=(command,args)=>{try{return execFileSync(command,args,{cwd:root,encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim()}catch{return null}};
const files=(run("git",["ls-files"])||"").split(/\r?\n/).filter(Boolean);
const routes=files.filter(file=>/^src\/app\/.+\/(page|route)\.tsx?$/.test(file)||/^src\/app\/(page|route)\.tsx?$/.test(file));
const snapshot={
  generatedAt:new Date().toISOString(),
  repository:{commit:run("git",["rev-parse","HEAD"]),branch:run("git",["branch","--show-current"]),trackedFiles:files.length,workingTreeClean:run("git",["status","--porcelain"])===""},
  application:{name:pkg.name,version:pkg.version,node:process.version,scripts:Object.keys(pkg.scripts||{}),runtimeDependencies:pkg.dependencies||{},developmentDependencies:pkg.devDependencies||{},routeFiles:routes.sort()},
  disclosure:"Repository metadata only. This snapshot contains no revenue, customer, traffic, environment, secret, database, or production-health claims."
};
const output=resolve(root,"BROKER_DATA_ROOM/generated/technical-snapshot.json");
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,`${JSON.stringify(snapshot,null,2)}\n`,"utf8");
console.log(`Wrote ${output}`);

