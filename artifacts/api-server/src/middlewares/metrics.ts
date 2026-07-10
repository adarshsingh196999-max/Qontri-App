import type { Request, Response, NextFunction } from "express";

interface RequestRecord {
  method: string;
  path: string;
  status: number;
  duration: number;
  at: string;
}

interface RouteStats {
  count: number;
  totalMs: number;
  errors: number;
}

const WINDOW = 500;

let totalRequests = 0;
let errorCount = 0;
const recentTimes: number[] = [];
const slowRequests: RequestRecord[] = [];
const routeStats: Map<string, RouteStats> = new Map();

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const key = `${req.method} ${req.path}`;

    totalRequests++;
    if (res.statusCode >= 400) errorCount++;

    recentTimes.push(duration);
    if (recentTimes.length > WINDOW) recentTimes.shift();

    if (duration > 500) {
      slowRequests.unshift({ method: req.method, path: req.path, status: res.statusCode, duration, at: new Date().toISOString() });
      if (slowRequests.length > 20) slowRequests.pop();
    }

    const s = routeStats.get(key) ?? { count: 0, totalMs: 0, errors: 0 };
    s.count++;
    s.totalMs += duration;
    if (res.statusCode >= 400) s.errors++;
    routeStats.set(key, s);
  });
  next();
}

export function getMetrics() {
  const sorted = [...recentTimes].sort((a, b) => a - b);
  const avg = sorted.length ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : 0;
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] ?? 0 : 0;

  const mem = process.memoryUsage();
  const toMB = (b: number) => Math.round(b / 1024 / 1024);

  const topRoutes = [...routeStats.entries()]
    .map(([route, s]) => ({
      route,
      count: s.count,
      avgMs: Math.round(s.totalMs / s.count),
      errors: s.errors,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      heapUsedMb: toMB(mem.heapUsed),
      heapTotalMb: toMB(mem.heapTotal),
      rssMb: toMB(mem.rss),
    },
    requests: {
      total: totalRequests,
      errors: errorCount,
      avgResponseMs: avg,
      p95ResponseMs: p95,
    },
    slowRequests: slowRequests.slice(0, 10),
    topRoutes,
  };
}
