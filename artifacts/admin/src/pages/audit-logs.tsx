import { useState } from "react";
import { useGetAdminAuditLogs } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "admin_login", label: "Admin login" },
  { value: "admin_login_failed", label: "Login failed" },
  { value: "user_blocked", label: "User blocked" },
  { value: "user_unblocked", label: "User unblocked" },
  { value: "user_deleted", label: "User deleted" },
  { value: "user_data_exported", label: "Data exported" },
];

const ACTION_COLORS: Record<string, string> = {
  admin_login:          "bg-green-100 text-green-800 border-green-200",
  admin_login_failed:   "bg-red-100 text-red-800 border-red-200",
  user_blocked:         "bg-orange-100 text-orange-800 border-orange-200",
  user_unblocked:       "bg-blue-100 text-blue-800 border-blue-200",
  user_deleted:         "bg-red-100 text-red-800 border-red-200",
  user_data_exported:   "bg-violet-100 text-violet-800 border-violet-200",
};

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("all");
  const LIMIT = 25;

  const { data, isLoading, error } = useGetAdminAuditLogs({
    limit: LIMIT,
    page,
    action: actionFilter !== "all" ? actionFilter : undefined,
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  if (error) {
    return (
      <Layout>
        <div className="p-6 bg-destructive/10 text-destructive rounded-md flex items-center gap-3 border border-destructive/20">
          <AlertCircle className="h-5 w-5" />
          Failed to load audit logs.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground mt-1">Complete trail of admin and security events.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v || "all"); setPage(1); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead className="w-[180px]">Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-[160px]">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [0,1,2,3,4,5].map((i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    </TableRow>
                  ))
                ) : !data || data.logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.id}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border ${ACTION_COLORS[log.action] ?? "bg-muted text-foreground border-border"}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.targetEmail ? (
                          <span className="font-mono text-xs">{log.targetEmail}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {log.details || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {data && data.total > LIMIT && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data.total} total events · page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
