const os=require('os');
for(const n of Object.values(os.networkInterfaces()||{}))
  for(const a of n||[])
    if(a.family==='IPv4' && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address))
      { process.stdout.write(a.address); process.exit(); }
process.stdout.write('127.0.0.1');