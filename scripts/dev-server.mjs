/**
 * 調試用 HTTP 服務（in-process，不 spawn 外部程序）。
 *
 * 兩大職責：
 *   1. 靜態服務 index.html / app.js（同 serve.mjs）
 *   2. 調試 REST：直接操作「同一個」GameStore，供 curl / 開發者驗證三連互動
 *      與核心邏輯（對照原版 HTTP REST 的精神，但不照搬過時指令，僅參考）。
 *
 * 用法：node scripts/dev-server.mjs [port]
 *   預設 5173；REST 掛在 http://127.0.0.1:<port>/api/...
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localIP } from './net-util.mjs';

import { SliderMatrix } from '../dist/core/SliderMatrix.js';
import { GameHistory } from '../dist/core/GameHistory.js';
import {
  selectGap,
  selectBlock,
  move,
  undo,
  redo,
  shuffle,
  reset,
} from '../dist/core/CommandBus.js';
import { isValidDirectionForGap } from '../dist/core/rules.js';

// ---------- 遊戲狀態（單一宿主，與後續瀏覽器端邏輯同源） ----------
class DevState {
  constructor(m = 4, n = 4, step = 2) {
    this.m = m;
    this.n = n;
    this.step = step;
    this.game = new SliderMatrix(m, n);
    this.history = new GameHistory();
    this.selectedGap = null;
    this.selectedBlock = null;
    this.stepCount = 0;
  }

  buildCtx() {
    /* CommandBus 期望一個 ctx 物件；用當前 DevState 本身充當，欄位已對齊 */
    return this;
  }

  status() {
    const b = this.game.get_boundaries();
    return {
      ok: true,
      puzzle: `${this.step}~${this.m}*${this.n}`,
      step_count: this.stepCount,
      solved: this.game.is_solved(),
      matrix: this.game.export_map(),
      selected_gap: this.selectedGap ? [this.selectedGap.type, this.selectedGap.line] : null,
      selected_block: this.selectedBlock,
      bounds: b,
      history_index: this.history.currentIndex,
      history_length: this.history.length,
    };
  }
}

const store = new DevState();

// ---------- 靜態服務 ----------
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function resolveSafe(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const abs = path.normalize(path.join(root, rel));
  if (!abs.startsWith(root)) return null;
  return abs;
}

// ---------- REST ----------
function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function handleApi(pathname, body) {
  const name = pathname.split('/').filter(Boolean)[0]; // /api/xxx -> xxx

  switch (name) {
    case 'status':
      return store.status();
    case 'map':
      return { ok: true, map: store.game.export_map() };

    case 'select_gap': {
      const type = body.type;
      const line = Number(body.line);
      if ((type !== 'h' && type !== 'v') || !Number.isInteger(line)) {
        return { ok: false, message: '需要 type(h/v) 且 line 為整數' };
      }
      const r = selectGap(store, type, line);
      if (r.ok) {
        store.selectedGap = { type, line };
        store.selectedBlock = null;
      }
      return r;
    }

    case 'select_block': {
      const row = Number(body.row);
      const col = Number(body.col);
      if (!Number.isInteger(row) || !Number.isInteger(col)) {
        return { ok: false, message: '需要 row/col 整數' };
      }
      const r = selectBlock(store, row, col);
      if (r.ok) store.selectedBlock = [row, col];
      return r;
    }

    case 'move': {
      const dir = body.direction;
      if (!['w', 's', 'a', 'd'].includes(dir)) {
        return { ok: false, message: 'direction 須為 w/s/a/d' };
      }
      if (store.selectedGap && !isValidDirectionForGap(store.selectedGap.type, dir)) {
        return { ok: false, message: `方向非法（${store.selectedGap.type === 'h' ? 'h→a/d' : 'v→w/s'}）` };
      }
      return move(store, dir);
    }

    case 'undo':
      return undo(store);
    case 'redo':
      return redo(store);
    case 'shuffle':
      return shuffle(store, Number(body.attempts) || 100);

    case 'reset':
      return reset(store);

    case 'deselect':
      store.selectedGap = null;
      store.selectedBlock = null;
      store.game.selected.clear();
      return { ok: true, message: '已清除選中' };

    case 'new': {
      const m = Number(body.m);
      const n = Number(body.n);
      const step = Number(body.step);
      if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step)) {
        return { ok: false, message: '需要 m/n/step 整數' };
      }
      if (step >= Math.max(m, n)) {
        return { ok: false, message: `step 須 < max(m,n)=${Math.max(m, n)}` };
      }
      store.m = m;
      store.n = n;
      store.step = step;
      store.game = new SliderMatrix(m, n);
      store.history = new GameHistory();
      store.selectedGap = null;
      store.selectedBlock = null;
      store.stepCount = 0;
      return { ok: true, message: `切換謎題 ${step}~${m}*${n}` };
    }

    default:
      return { ok: false, message: `未知 API: ${name}` };
  }
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
  const pathname = url.pathname;

  // CORS 預檢
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // 調試 REST
  if (pathname.startsWith('/api/')) {
    const body = req.method === 'POST' ? await readJson(req) : {};
    const restPath = pathname.replace(/^\/api/, '');
    const result = handleApi(restPath, body);
    sendJson(res, result);
    return;
  }

  // 靜態檔案
  const file = resolveSafe(pathname);
  if (!file) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[dev-server] 內網：http://${localIP()}:${port}  本機：http://127.0.0.1:${port}`);
  console.log(`[dev-server] REST API: http://127.0.0.1:${port}/api/status`);
});
