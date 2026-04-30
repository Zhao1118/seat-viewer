/**
 * fetch-seats.js - 获取腾讯文档座位数据
 * 用于 GitHub Actions
 */

const https = require('https');
const fs = require('fs');

const FILE_ID = 'fTYDtoctXaVu';
const SHEET_ID = 'BB08J2';
const TOKEN = process.env.TENCENT_DOCS_TOKEN;

if (!TOKEN) {
  console.error('❌ TENCENT_DOCS_TOKEN not set');
  process.exit(1);
}

// 腾讯文档 Sheet API
const options = {
  hostname: 'docs.qq.com',
  path: `/sheet/api/${FILE_ID}/${SHEET_ID}`,
  method: 'GET',
  headers: {
    'Cookie': `token=${TOKEN}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

console.log('Fetching seats data from Tencent Docs...');
console.log(`File: ${FILE_ID}, Sheet: ${SHEET_ID}`);

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      
      if (json.error || json.ret === -1) {
        console.error('❌ API error:', json.error || json.msg);
        process.exit(1);
      }
      
      const csvData = json.csv_data || json.data || '';
      
      if (!csvData) {
        console.error('❌ No csv_data in response');
        console.log('Response:', JSON.stringify(json, null, 2).substring(0, 500));
        process.exit(1);
      }
      
      // 解析 CSV
      const rows = csvData.split('\n');
      const seats = {};
      
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (cols.length < 4) continue;
        
        const seatId = cols[0]?.trim();
        const name = cols[3]?.trim();
        
        if (!seatId || isNaN(parseInt(seatId))) continue;
        
        seats[seatId] = {
          seatId: seatId,
          type: cols[1]?.trim() || '普通',
          status: name ? '已订' : '空闲',
          name: name || '',
          startTime: cols[4]?.trim() || '',
          endTime: cols[5]?.trim() || '',
          days: cols[6]?.trim() || '',
          remaining: cols[7]?.trim() || '',
          note: cols[8]?.trim() || ''
        };
      }
      
      fs.writeFileSync('public/seats.json', JSON.stringify(seats, null, 2));
      console.log(`✅ Updated ${Object.keys(seats).length} seats`);
      console.log('Saved to public/seats.json');
      
    } catch (e) {
      console.error('❌ Parse error:', e.message);
      console.log('Raw response:', data.substring(0, 500));
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
});

req.setTimeout(30000, () => {
  console.error('❌ Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();
