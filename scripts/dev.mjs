import {spawn} from 'node:child_process';
const api=spawn('node',['--import','tsx','--watch','apps/api/src/start.ts'],{stdio:'inherit',env:{...process.env,PORT:'4175',PUBLIC_ORIGIN:'http://127.0.0.1:4173'}});
const web=spawn('node',['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'],{stdio:'inherit'});
let stopping=false;
function stop(){if(stopping)return;stopping=true;api.kill();web.kill();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);api.on('exit',stop);web.on('exit',stop);
