import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
const manifest=JSON.parse(await fs.readFile('release-files.json','utf8')),files=[...manifest.files];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())await walk(file);else files.push(file);}}
for(const dir of manifest.directories)await walk(dir);
const unique=[...new Set(files)].sort();
const forbidden=/^(?:\.runtime|evidence|delivery-local|dist|\.vercel|node_modules|\.git)\//;
const findings=[];
for(const file of unique){if(forbidden.test(file)||/(^|\/)(\.env(?:\..*)?|auth\.json|master\.key)$/.test(file))findings.push(`${file}: prohibited path`);
 const text=await fs.readFile(file,'utf8');if(/sk-(?:proj-)?[A-Za-z0-9_-]{25,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{25,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]{30,}|[A-Z]:\\Users\\[^\\]+\\/i.test(text))findings.push(`${file}: possible credential/private path`);
}
let staged=[];try{staged=execFileSync('git',['ls-files','--cached'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)}catch{}
for(const file of staged)if(!unique.includes(file))findings.push(`${file}: staged outside release allowlist`);
if(findings.length)throw Error(findings.join('\n'));
await fs.mkdir('delivery-local',{recursive:true});await fs.writeFile('delivery-local/git-paths.txt',unique.join('\n')+'\n');
const report={checkedAt:new Date().toISOString(),filesChecked:unique.length,stagedFiles:staged.length,findings:[],excluded:['raw evidence and logs','Paperclip database and encrypted secrets','Codex sessions/authentication','user filesystem paths','Vercel local configuration','local screenshots and benchmarks'],note:'Pattern scan plus explicit allowlist; no raw execution dumps are published.'};
await fs.writeFile('delivery-local/security-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--package')){const out='delivery-local/source';for(const file of unique){const target=path.join(out,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(file,target);}console.log(`Source package prepared at ${out}`);}
