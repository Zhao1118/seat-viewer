/**
 * fetch-seats.js - 获取腾讯文档座位数据
 * 使用 mcporter CLI 调用腾讯文档 MCP API
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FILE_ID = 'fTYDtoctXaVu';
const SHEET_ID = 'BB08J2';

// 工作目录为脚本所在目录的父目录
const workDir = path.resolve(__dirname, '..');
const publicDir = path.join(workDir, 'public');

// 确保 public 目录存在
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Fetching seats data from Tencent Docs via mcporter...');
console.log(`File: ${FILE_ID}, Sheet: ${SHEET_ID}`);

try {
  // 使用 mcporter 调用腾讯文档 API（Windows 用双引号）
  const args = JSON.stringify({
    file_id: FILE_ID,
    sheet_id: SHEET_ID,
    start_row: 0,
    start_col: 0,
    end_row: 30,
    end_col: 10,
    return_csv: true
  });
  
  const result = execSync(
    `mcporter call tencent-docs sheet.get_cell_data --args "${args.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  
  const response = JSON.parse(result);
  
  if (response.error) {
    console.error('❌ API error:', response.error);
    process.exit(1);
  }
  
  const csvData = response.csv_data;
  if (!csvData) {
    console.error('❌ No csv_data in response');
    process.exit(1);
  }
  
  // 解析 CSV
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) {
    console.error('❌ Not enough data rows');
    process.exit(1);
  }
  
  const seats = {};
  
  // 跳过表头，从第2行开始
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 4) continue;
    
    const seatId = cols[0].trim();
    if (!seatId || isNaN(parseInt(seatId))) continue;
    
    const name = cols[3].trim();
    
    seats[seatId] = {
      seatId: seatId,
      type: cols[1].trim() || '普通',
      status: name ? '已订' : '空闲',
      name: name || '',
      startTime: cols[4].trim() || '',
      endTime: cols[5].trim() || '',
      days: cols[6].trim() || '',
      remaining: cols[7].trim() || '',
      note: cols[8].trim() || ''
    };
  }
  
  fs.writeFileSync(path.join(publicDir, 'seats.json'), JSON.stringify(seats, null, 2));
  console.log(`✅ Updated ${Object.keys(seats).length} seats`);
  console.log('Saved to public/seats.json');
  
} catch (e) {
  console.error('❌ Error:', e.message);
  if (e.stderr) console.error('stderr:', e.stderr);
  process.exit(1);
}
