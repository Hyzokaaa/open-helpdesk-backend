const { execSync } = require('child_process');
const port = process.argv[2] || '3000';

try {
  if (process.platform === 'win32') {
    const out = execSync('netstat -ano').toString();
    const matches = out.matchAll(new RegExp(`TCP\\s+[\\d.:]+:${port}\\s+[\\d.:]+\\s+LISTENING\\s+(\\d+)`, 'g'));
    const pids = new Set([...matches].map(m => m[1]));
    if (pids.size === 0) {
      console.log(`Port ${port} is not in use`);
    } else {
      for (const pid of pids) {
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`Killed PID ${pid} on port ${port}`);
      }
    }
  } else {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
    console.log(`Killed processes on port ${port}`);
  }
} catch (e) {
  console.log(`Port ${port} is not in use`);
}
