/**
 * seat-proxy.js - 腾讯文档座位数据代理
 * 使用 mcporter 调用腾讯文档 API 获取座位数据
 * 端口：38080
 * file_id: fTYDtoctXaVu (小新自习室座位表)
 * sheet_id: BB08J2 (1店)
 */

const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const PORT = 38080;
const FILE_ID = 'fTYDtoctXaVu';
const SHEET_ID = 'BB08J2';

const MCPORTER_BIN = path.join(
  process.env.APPDATA,
  'QClaw',
  'npm-global',
  'node_modules',
  'mcporter',
  'dist',
  'cli.js'
);

// 通过 mcporter 调用 sheet.get_cell_data
function fetchSheetData() {
  const env = { ...process.env, TENCENT_DOCS_TOKEN: process.env.TENCENT_DOCS_TOKEN || 'ea47a9f01f3e4900882706154cb747c3' };
  const args = JSON.stringify({
    file_id: FILE_ID,
    sheet_id: SHEET_ID,
    start_row: 0,
    start_col: 0,
    end_row: 40,
    end_col: 8,
    return_csv: true
  });
  const cmd = 'node "' + MCPORTER_BIN + '" call tencent-docs sheet.get_cell_data --args "' + args.replace(/"/g, '\\"') + '"';
  const out = execSync(cmd, { env, encoding: 'utf8' });
  return JSON.parse(out);
}

// 解析 CSV 数据为 seat-viewer 需要的格式
function parseCSV(csvData) {
  const lines = csvData.trim().split('\n');
  const seats = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const seatId = cols[0].trim();
    if (!seatId || isNaN(parseInt(seatId))) continue;

    const name = cols[3] ? cols[3].trim() : '';
    // 姓名有内容=已订，空白=空闲
    const status = name ? '已订' : '空闲';

    seats[seatId] = {
      seatId: seatId,
      type: cols[1] ? cols[1].trim() : '',
      status: status,
      name: name,
      startTime: cols[4] ? cols[4].trim() : '',
      endTime: cols[5] ? cols[5].trim() : '',
      days: cols[6] ? cols[6].trim() : '',
      remaining: cols[7] ? cols[7].trim() : '',
      note: cols[8] ? cols[8].trim() : ''
    };
  }

  return seats;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.url === '/seat-data' || req.url === '/') {
    try {
      const result = fetchSheetData();
      if (result.error) throw new Error(result.error);
      const seats = parseCSV(result.csv_data);
      res.end(JSON.stringify(seats, null, 2));
      console.log('[' + new Date().toLocaleTimeString() + '] OK: ' + Object.keys(seats).length + ' seats');
    } catch (e) {
      console.error('Error:', e.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  } else if (req.url === '/health') {
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log('座位代理已启动: http://localhost:' + PORT);
  console.log('文档: https://docs.qq.com/sheet/DZlRZRHRvY3RYYVZ1');
});
