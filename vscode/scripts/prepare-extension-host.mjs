// Download only the manifest's minimum supported official VS Code build.
// Never install into a user profile or publish an extension.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const version=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")).engines.vscode.replace(/^\^/,"");
assert(/^\d+\.\d+\.\d+$/.test(version),"Minimum VS Code version must be explicit");
const platform=({win32:{x64:"win32-x64-archive",arm64:"win32-arm64-archive"},linux:{x64:"linux-x64",arm64:"linux-arm64"},darwin:{x64:"darwin",arm64:"darwin-arm64"}})[process.platform]?.[process.arch];
assert(platform,"Unsupported extension-host platform");
const metadata=await fetch(`https://update.code.visualstudio.com/api/versions/${version}/${platform}/stable`,{signal:AbortSignal.timeout(30000),redirect:"error"});
assert(metadata.ok,`Official VS Code metadata HTTP ${metadata.status}`);
const release=await metadata.json();const url=new URL(release.url);
assert.equal(release.name,version);assert(/^[a-f0-9]{64}$/i.test(release.sha256hash));
assert(url.protocol==="https:" && !url.username && !url.password && (url.hostname.endsWith(".microsoft.com")||url.hostname.endsWith(".visualstudio.com")));
const target=path.join(root,".vscode-test");fs.mkdirSync(target,{recursive:true});
const scratch=fs.mkdtempSync(path.join(target,`minimum-${version}-`));
const archive=path.join(scratch,process.platform==="linux"?"code.tar.gz":"code.zip");
const response=await fetch(url,{signal:AbortSignal.timeout(180000),redirect:"error"});
assert(response.ok,`Official VS Code download HTTP ${response.status}`);
const hash=createHash("sha256");let size=0;const fd=fs.openSync(archive,"wx");
try{for await(const chunk of response.body){size+=chunk.length;assert(size<=350*1024*1024,"VS Code archive exceeds budget");hash.update(chunk);fs.writeSync(fd,chunk);}}finally{fs.closeSync(fd);}
assert.equal(hash.digest("hex"),release.sha256hash.toLowerCase(),"VS Code archive checksum mismatch");
const extracted=path.join(scratch,"extracted");fs.mkdirSync(extracted);
const result=spawnSync("tar",["-xf",archive,"-C",extracted],{encoding:"utf8",windowsHide:true});
assert.equal(result.status,0,"Official VS Code archive extraction failed");
const executable=process.platform==="win32"?path.join(extracted,"Code.exe"):process.platform==="darwin"?path.join(extracted,"Visual Studio Code.app/Contents/MacOS/Electron"):path.join(extracted,fs.readdirSync(extracted).find(n=>n.startsWith("VSCode-linux-"))??"","code");
assert(fs.statSync(executable).isFile());
fs.writeFileSync(path.join(scratch,"provenance.json"),JSON.stringify({version,platform,sha256:release.sha256hash,url:release.url},null,2));
console.log(executable);
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`executable=${executable}\n`);
