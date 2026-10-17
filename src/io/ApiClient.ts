/**
 * 後端 API 客戶端：封裝賬號 / 排行榜 / AI 中轉三組端點。
 * 對應後端 GatenneaSliderBackend（Cloudflare Worker，獨立部署）。
 * 路徑契約（見後端 src/index.ts）：/api/account/*、/api/leaderboard/*、/api/ai/relay。
 *
 * 基址（API_BASE）部署後替換為真實 Worker 地址；也可運行時 setApiBase() 覆蓋
 * （例如從 localStorage 讀取自定義域）。未部署前占位地址請求會失敗，由 request() 靜默拋錯。
 *
 * 與本地 Records（feature/Records.ts）的對接：提交成績時把 RecordItem 的
 * {m,n,step,time_ms,moves} 映射為 submitScore({mode, form, steps, time_ms})——
 * mode 用 puzzleKey 的 step~ 段、form 用 "square"/"tri"/"mi"、steps 用 moves。
 */

// ===== 部署自定义域名后需改的配置（共 3 处，清单见后端 README「绑定自定义域名」节）=====
//   ① GatenneaSlider/gui/feature_ai.py 的 RELAY_ENDPOINT（游戏 exe 侧）
//   ② 本文件 API_BASE（网页版侧）
//   ③ GatenneaSliderBackend/wrangler.toml 的 ALLOWED_ORIGIN（仅官网也换域时才改）
// 改本常量后须重新 build 网页版；运行时也可 setApiBase() 覆盖。
let API_BASE = 'https://gatennea-backend.gatennea.workers.dev'; // 作者后端真实地址（自定义域后改这里）
let APP_KEY: string | null = null; // 僅當後端啟用了發布校驗（APP_KEY）才需要

export function setApiBase(url: string): void {
  API_BASE = url.replace(/\/+$/, '');
}
export function getApiBase(): string {
  return API_BASE;
}
export function setAppKey(key: string | null): void {
  APP_KEY = key;
}

const TOKEN_KEY = 'gatennea-slider-web:token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(t: string | null): void {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 忽略 */
  }
}

// ---------------- 類型 ----------------
export interface AccountInfo {
  id: number;
  username: string;
  created_at?: number;
}
export interface RegisterResult {
  token: string;
  userId: number;
  username: string;
}
export interface LoginResult {
  token: string;
  userId: number;
  username: string;
}
export interface ScoreRow {
  username: string;
  mode: string;
  form: string;
  steps: number;
  time_ms: number | null;
  created_at: number;
}
export interface BestRow {
  mode: string;
  form: string;
  best_steps: number;
  best_time_ms: number | null;
}
export interface SubmitScoreInput {
  mode: string;
  form: string;
  steps: number;
  time_ms?: number | null;
}
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------- 底層 ----------------
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (APP_KEY) headers.set('X-App-Key', APP_KEY);

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, '網絡請求失敗（後端可能尚未部署或不可達）');
  }
  if (resp.status === 204) return undefined as unknown as T;

  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    /* 某些錯誤響應可能無 JSON body */
  }
  if (!resp.ok) {
    const msg = (data && (data.error || data.detail)) || resp.statusText || `HTTP ${resp.status}`;
    throw new ApiError(resp.status, String(msg));
  }
  return data as T;
}

// ---------------- 賬號 ----------------
export async function register(username: string, password: string): Promise<RegisterResult> {
  const r = await request<RegisterResult>('/api/account/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(r.token);
  return r;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const r = await request<LoginResult>('/api/account/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(r.token);
  return r;
}

export async function logout(): Promise<void> {
  setToken(null);
}

export async function me(): Promise<{ user: AccountInfo | null }> {
  return request<{ user: AccountInfo | null }>('/api/account/me', { method: 'GET' });
}

// ---------------- 排行榜 ----------------
export async function submitScore(input: SubmitScoreInput): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/leaderboard/submit', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function topScores(
  mode: string,
  form: string,
  limit = 20,
): Promise<{ scores: ScoreRow[] }> {
  const qs = new URLSearchParams({ mode, form, limit: String(limit) });
  return request<{ scores: ScoreRow[] }>(`/api/leaderboard/top?${qs.toString()}`, {
    method: 'GET',
  });
}

export async function myBest(): Promise<{ best: BestRow[] }> {
  return request<{ best: BestRow[] }>('/api/leaderboard/me', { method: 'GET' });
}

// ---------------- AI 中轉 ----------------
/** 轉發 OpenAI 兼容 chat 請求；不帶 model 時服務端用其默認模型。匿名 5/min、登錄 20/min。 */
export async function relayChat(messages: ChatMessage[], model?: string): Promise<string> {
  const body: any = { messages, temperature: 0 };
  if (model) body.model = model;
  const data = await request<{ choices?: { message: { content: string } }[] }>(
    '/api/ai/relay',
    { method: 'POST', body: JSON.stringify(body) },
  );
  return data.choices?.[0]?.message?.content ?? '';
}
