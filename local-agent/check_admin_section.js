const crypto = require('crypto');
const fs = require('fs');
const xml = fs.readFileSync('check_config.xml', 'utf8');
const adminSection = xml.match(/UserName="admin"[\s\S]*?<\/X_HW_WebUserInfoInstance>/);
if (adminSection) console.log(adminSection[0].substring(0, 1200));
