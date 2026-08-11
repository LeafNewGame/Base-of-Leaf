const fs = require('fs');
const order = ['core','cards','map','stats','chat','io','folders','theme','cloud-ui','calendar','app'];
let combined = '';
for (const n of order) combined += '\n;//== '+n+' ==\n' + fs.readFileSync('js/'+n+'.js','utf8');
try { new Function(combined); console.log('DEPLOYED COPY COMBINED OK'); }
catch (e) { console.error('DEPLOYED COPY ERROR:', e.message); process.exit(1); }
for (const n of order) { try { new Function(fs.readFileSync('js/'+n+'.js','utf8')); } catch(e){ console.error('PER-FILE ERR ['+n+']:', e.message); process.exit(1);} }
console.log('all per-file OK');
