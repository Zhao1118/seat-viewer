/**
 * fetch-seats.js - 获取腾讯文档座位数据
 * 用于 GitHub Actions
 */

const { execSync } = require('child_process');
const fs = require('fs');

const FILE_ID = 'fTYDtoctXaVu';
const SHEET_ID = 'BB08J2';
const TOKEN = process.env.TENCENT_DOCS_TOKEN;

if (!TOKEN) {
  console.error('❌ TENCENT_DOCS_TOKEN not set');
  process.exit(1);
}

console.log('Fetching seats data from Tencent Docs...');
console.log(`File: ${FILE_ID}, Sheet: ${SHEET_ID}`);

try {
  // 使用 mcporter 获取数据
  const args = JSON.stringify({
    file_id: FILE_ID,
    sheet_id: SHEET_ID,
    start_row: 0,
    start_col: 0,
    end_row: 30,
    end_col: 8,
    return_csv: true
  });
  
  const result = execSync(
    `mcporter call tencent-docs sheet.get_cell_data --args '${args}'`,
    {
      env: { ...process.env, TENCENT_DOCS_TOKEN: TOKEN },
      encoding: 'utf-8',
      timeout: 60000
    }
  );
  
  const response = JSON.parse(result);
  
  if (response.error) {
    console.error('❌ API error:', response.error);
    process.exit(1);
  }
  
  const csvData = response.csv_data || response.data?.csv_data;
  
  if (!csvData) {
    console.error('❌ No csv_data in response');
    console.log('Response:', JSON.stringify(response, null, 2).substring(0, 500));
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
  console.error('❌ Error:', e.message);
  if (e.stderr) console.error('stderr:', e.stderr.toString());
  process.exit(1);
}