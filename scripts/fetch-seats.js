// fetch-seats.js — 从飞书多维表格获取座位数据，输出 seats.json
// 用于 GitHub Actions 定时运行

const https = require('https');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FEISHU_APP_ID || 'cli_a97e4dd4ca78dbb4';
const APP_SECRET = process.env.FEISHU_APP_SECRET || '';
const BITABLE_APP_TOKEN = 'FVN6bZd4AaPZw2sUotxcYGSUnIc';
const TABLE_ID = 'tblVM1qbql7ZNflw';

function httpsPost(hostname, ppath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname, path: ppath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(hostname, ppath, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path: ppath, method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!APP_SECRET) {
    console.error('FEISHU_APP_SECRET not set');
    process.exit(1);
  }

  // 1. 获取 tenant_access_token
  console.log('Getting tenant_access_token...');
  const tokenRes = await httpsPost('open.feishu.cn', '/open-apis/auth/v3/tenant_access_token/internal/', {
    app_id: APP_ID,
    app_secret: APP_SECRET
  });
  if (tokenRes.code !== 0) {
    console.error('Failed to get token:', tokenRes);
    process.exit(1);
  }
  const token = tokenRes.tenant_access_token;
  console.log('Token obtained successfully');

  // 2. 获取多维表格记录
  console.log('Fetching bitable records...');
  const recordsRes = await httpsGet('open.feishu.cn',
    `/open-apis/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${TABLE_ID}/records?page_size=100`,
    token
  );
  if (recordsRes.code !== 0) {
    console.error('Failed to fetch records:', recordsRes);
    process.exit(1);
  }

  // 3. 转换数据格式
  const seats = {};
  const items = recordsRes.data.items || [];
  items.forEach(item => {
    const f = item.fields;
    const seatId = String(f['座位号'] || '').trim();
    if (!seatId) return;
    
    // 判断状态：有预定人姓名 → 已订，无 → 空闲
    const name = String(f['预定人微信名'] || '').trim();
    const statusCol = String(f['座位状态'] || '').trim();
    const isOccupied = name.length > 0 || statusCol === '已预定' || statusCol === '使用中';
    
    // 格式化时间
    const startTime = f['开始时间'] ? new Date(f['开始时间']).toLocaleDateString('zh-CN') : '';
    const endTime = f['结束时间'] ? new Date(f['结束时间']).toLocaleDateString('zh-CN') : '';
    
    seats[seatId] = {
      status: isOccupied ? statusCol || '已预定' : '空闲',
      name: name,
      start: startTime,
      end: endTime,
      days: String(f['剩余天数'] !== undefined ? f['剩余天数'] : ''),
      note: String(f['备注'] || '').trim()
    };
  });

  // 4. 输出 seats.json
  const outputPath = process.env.SEATS_OUTPUT_PATH || path.join(__dirname, '..', 'seats.json');
  const output = {
    updated: new Date().toISOString(),
    seats: seats
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`Seats data written to ${outputPath}`);
  console.log(`Total seats: ${Object.keys(seats).length}`);
  console.log(`Occupied: ${Object.values(seats).filter(s => s.status !== '空闲').length}`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
