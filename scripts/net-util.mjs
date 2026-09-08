/**
 * 網路工具：抓取本機非內部 IPv4（用於內網直連提示）。
 */
import os from 'node:os';

export function localIP() {
  let best = '127.0.0.1';
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        // 偏好區域網路私有位址（192.168 / 10. / 172.16~31）
        if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(net.address)) {
          return net.address;
        }
        if (best === '127.0.0.1') best = net.address;
      }
    }
  }
  return best;
}
