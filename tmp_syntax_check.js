const fs = require('fs');
const text = fs.readFileSync('src/pages/CustomerDashboard/CustomerDashboard.jsx','utf8');
const lines = text.split(/\r?\n/);
function report(rangeStart, rangeEnd) {
  const snippet = lines.slice(rangeStart-1, rangeEnd);
  let paren = 0, brace = 0, bracket = 0;
  let inString = null, escape = false;
  snippet.forEach((line, idx)=>{
    for (const ch of line) {
      if (inString) {
        if (escape) { escape=false; continue; }
        if (ch === '\\') { escape=true; continue; }
        if (ch === inString) { inString=null; }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
      if (ch==='(') paren++;
      if (ch===')') paren--;
      if (ch==='{') brace++;
      if (ch==='}') brace--;
      if (ch==='[') bracket++;
      if (ch===']') bracket--;
    }
  });
  console.log('range', rangeStart, rangeEnd, 'paren', paren, 'brace', brace, 'bracket', bracket);
}
report(1580,1998);
report(2000,2192);
report(2194,2475);
