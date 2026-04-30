/**
 * fetch-seats.js - 获取腾讯文档座位数据
 * 用于 GitHub Actions（直接 HTTPS 请求，不依赖 mcporter）
 */

const https = require('https');
const fs = require('fs');

const FILE_ID = 'fTYDtoctXaVu';
const SHEET_ID = 'BB08J2';
const TOKEN = process.env.TENCENT_DOCS_TOKEN;

if (!TOKEN) {
  console.error('TENCENT_DOCS_TOKEN not set');
  process.exit(1);
}

// 清理 Token（去掉可能的空格/换行/特殊字符）
const cleanToken = TOKEN.trim().replace(/[\r\n\x00-\x1F]/g, '');

console.log('Fetching seats data from Tencent Docs...');
console.log(`File: ${FILE_ID}, Sheet: ${SHEET_ID}`);
console.log(`Token length: ${cleanToken.length}`);

const url = `https://docs.qq.com/sheet/api/v3/sheets/${SHEET_ID}/data?file_id=${FILE_ID}&reader_client_version=1`;

const options = {
  method: 'GET',
  headers: {
    'Cookie': `openToken=${cleanToken}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

https.get(url, options, (res) => {
  let data = '';
  
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.retcode && response.retcode !== 0) {
        console.error('❌ API error:', response.retmsg || response);
        process.exit(1);
      }
      
      // 解析数据
      const sheetData = response.data || response;
      const rows = sheetData.rows || sheetData.initialSortedRowData?.rows || [];
      
      if (!rows || rows.length === 0) {
        console.error('❌ No data rows found');
        console.log('Response keys:', Object.keys(response));
        process.exit(1);
      }
      
      const seats = {};
      
      // 跳过表头，从第2行开始
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].cells || rows[i].values || rows[i];
        if (!cols || cols.length < 4) continue;
        
        const seatId = (cols[0]?.value || cols[0] || '').toString().trim();
        const name = (cols[3]?.value || cols[3] || '').toString().trim();
        
        if (!seatId || isNaN(parseInt(seatId))) continue;
        
        seats[seatId] = {
          seatId: seatId,
          type: (cols[1]?.value || cols[1] || '普通').toString().trim(),
          status: name ? '已订' : '空闲',
          name: name || '',
          startTime: (cols[4]?.value || cols[4] || '').toString().trim(),
          endTime: (cols[5]?.value || cols[5] || '').toString().trim(),
          days: (cols[6]?.value || cols[6] || '').toString().trim(),
          remaining: (cols[7]?.value || cols[7] || '').toString().trim(),
          note: (cols[8]?.value || cols[8] || '').toString().trim()
        };
      }
      
      fs.writeFileSync('public/seats.json', JSON.stringify(seats, null, 2));
      console.log(`✅ Updated ${Object.keys(seats).length} seats`);
      console.log('Saved to public/seats.json');
      
    } catch (e) {
      console.error('❌ Parse error:', e.message);
      console.log('Response (first 500 chars):', data.substring(0, 500));
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
});
