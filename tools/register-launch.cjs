// Registers the dev server in the shared Claude launch.json (one-off helper).
const fs = require('fs');
const file = 'D:/OneDrive/Documents/Claude Code/.claude/launch.json';
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
j.configurations = j.configurations.filter((c) => c.name !== 'depths-of-moria');
j.configurations.push({
  name: 'depths-of-moria',
  runtimeExecutable: 'powershell',
  runtimeArgs: ['-NoProfile', '-Command', "$env:Path += ';C:\\Program Files\\nodejs'; Set-Location 'D:\\dev\\depths-of-moria'; npx.cmd vite --port 8140 --strictPort"],
  port: 8140,
});
fs.writeFileSync(file, JSON.stringify(j, null, 2));
console.log('ok', j.configurations.length);
