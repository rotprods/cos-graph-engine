const fs = require('fs');
const base = `{"compilerOptions":{"target":"ES2022","module":"commonjs","lib":["ES2022"],"declaration":true,"outDir":"./dist","rootDir":"./src","strict":true,"esModuleInterop":true,"skipLibCheck":true,"forceConsistentCasingInFileNames":true,"composite":true},"include":["src/**/*"]}`;
const packages = ['runtime','memory','knowledge','cognition','execution','orchestration','observability','api','infrastructure','deployment'];
for (const p of packages) {
  const path = `/home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/cos/packages/${p}/tsconfig.json`;
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, base);
    console.log(`Created: ${p}/tsconfig.json`);
  } else {
    console.log(`Exists: ${p}/tsconfig.json`);
  }
}
console.log('Done');