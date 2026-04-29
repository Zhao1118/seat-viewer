// Vercel Serverless Function - 代理腾讯文档 API
// 调用腾讯文档 MCP HTTP 端点获取座位数据

const MCP_URL = 'https://docs.qq.com/openapi/mcp';
const FILE_ID = 'fTYDtoctXaVu';
const SHEET_ID = 'BB08J2';

// 从 mcporter 配置读取 token 的备选：直接用环境变量
// 部署时设置 TENCENT_DOCS_TOKEN 环境变量
function getToken() {
    return process.env.TENCENT_DOCS_TOKEN || '';
}

export default async function handler(req, res) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = getToken();
    if (!token) {
        return res.status(500).json({ error: 'TENCENT_DOCS_TOKEN not configured' });
    }

    try {
        // 调用腾讯文档 MCP - 使用 JSON-RPC 协议
        const mcpRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'sheet.get_cell_data',
                arguments: {
                    file_id: FILE_ID,
                    sheet_id: SHEET_ID,
                    start_row: 0,
                    start_col: 0,
                    end_row: 50,
                    end_col: 11,
                    return_csv: true
                }
            }
        };

        const response = await fetch(MCP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify(mcpRequest)
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('MCP HTTP error:', response.status, text);
            return res.status(502).json({ error: `MCP API returned ${response.status}`, detail: text.substring(0, 200) });
        }

        const data = await response.json();

        // MCP JSON-RPC 响应格式
        if (data.error) {
            console.error('MCP error:', data.error);
            return res.status(502).json({ error: data.error.message || 'MCP error', code: data.error.code });
        }

        // 提取 csv_data 从 MCP 响应的 content 数组
        let csvData = '';
        let cellsData = null;

        if (data.result && data.result.content) {
            for (const item of data.result.content) {
                if (item.type === 'text') {
                    try {
                        const parsed = JSON.parse(item.text);
                        if (parsed.csv_data) csvData = parsed.csv_data;
                        if (parsed.cells) cellsData = parsed.cells;
                    } catch (e) {
                        // 可能直接就是 CSV 文本
                        if (item.text.includes(',') && item.text.includes('\n')) {
                            csvData = item.text;
                        }
                    }
                }
            }
        }

        // 返回与本地代理相同的格式
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
        return res.status(200).json({
            csv_data: csvData,
            cells: cellsData,
            _source: 'vercel-serverless',
            _ts: new Date().toISOString()
        });

    } catch (error) {
        console.error('Seat data fetch error:', error);
        return res.status(500).json({ error: error.message });
    }
}
