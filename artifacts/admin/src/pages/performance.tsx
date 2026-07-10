import { useEffect } from "react";
import { useGetAdminPerformance } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Clock, Cpu, MemoryStick, Activity, Zap, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAdminPerformanceQueryKey } from "@workspace/api-client-react";

function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function MemBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const color = pct > 85 ? "bg-red-500" : pct > 65 ? "bg-amber-500" : "bg-primary";
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span className="font-mono">{used} MB / {total} MB ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Performance() {
  const { data, isLoading, error } = useGetAdminPerformance();
  const qc = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => {
      void qc.invalidateQueries({ queryKey: getGetAdminPerformanceQueryKey() });
    }, 10_000);
    return () => clearInterval(id);
  }, [qc]);

  if (error) {
    return (
      <Layout>
        <div className="p-6 bg-destructive/10 text-destructive rounded-md flex items-center gap-3 border border-destructive/20">
          <AlertCircle className="h-5 w-5" />
          Failed to load performance data.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
            <p className="text-muted-foreground mt-1">Live server metrics — refreshes every 10 seconds.</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin opacity-60" />
            auto-refresh
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* ── Stats row ── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">Server Uptime</p>
                    <Clock className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-2xl font-bold">{fmtUptime(data.uptimeSeconds)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">Total Requests</p>
                    <Activity className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold">{data.requests.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className={data.requests.errors > 0 ? "text-red-500 font-medium" : ""}>{data.requests.errors} errors</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">Response Time</p>
                    <Zap className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold">{data.requests.avgResponseMs}<span className="text-sm font-normal text-muted-foreground ml-1">ms avg</span></p>
                  <p className="text-xs text-muted-foreground mt-1">p95: {data.requests.p95ResponseMs} ms</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium">Memory (RSS)</p>
                    <MemoryStick className="h-4 w-4 text-violet-500" />
                  </div>
                  <p className="text-2xl font-bold">{data.memory.rssMb}<span className="text-sm font-normal text-muted-foreground ml-1">MB</span></p>
                  <p className="text-xs text-muted-foreground mt-1">heap: {data.memory.heapUsedMb}/{data.memory.heapTotalMb} MB</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Memory detail ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="h-4 w-4" /> Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MemBar used={data.memory.heapUsedMb} total={data.memory.heapTotalMb} label="Heap" />
                <MemBar used={data.memory.rssMb} total={Math.max(data.memory.rssMb, data.memory.heapTotalMb + 64)} label="RSS (Total Process)" />
              </CardContent>
            </Card>

            {/* ── Two-column tables ── */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Slow requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Slow Requests (&gt;500ms)</CardTitle>
                  <CardDescription>Most recent {data.slowRequests.length} slow calls</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.slowRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No slow requests recorded.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Method</TableHead>
                          <TableHead>Path</TableHead>
                          <TableHead className="text-right">ms</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.slowRequests.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono">{r.method}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs truncate max-w-[140px]">{r.path}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-medium text-amber-600">{r.duration}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Top routes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Routes</CardTitle>
                  <CardDescription>By request count since last restart</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.topRoutes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No request data yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          <TableHead className="text-right">Avg ms</TableHead>
                          <TableHead className="text-right">Errors</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topRoutes.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs truncate max-w-[130px]">{r.route}</TableCell>
                            <TableCell className="text-right text-xs font-medium">{r.count}</TableCell>
                            <TableCell className="text-right text-xs">{r.avgMs}</TableCell>
                            <TableCell className="text-right text-xs">
                              {r.errors > 0
                                ? <span className="text-red-500 font-medium">{r.errors}</span>
                                : <span className="text-muted-foreground">0</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
