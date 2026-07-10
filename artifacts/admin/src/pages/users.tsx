import React, { useState, useMemo } from "react";
import { useGetAdminUsers, useGetAdminUserDetail } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAdminUsersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Search, ArrowUpDown, ChevronDown, ChevronRight,
  User, Users as UsersIcon, Briefcase, Receipt,
  ShieldOff, ShieldCheck, Trash2, Download, CreditCard, Shield
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const TOKEN_KEY = "qontri_admin_token";

async function adminFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY) ?? "";
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" })) as { error?: string };
    throw new Error(err.error ?? "Request failed");
  }
  return res;
}

type SortField = "email" | "createdAt" | "groupsOwned" | "ietExpenses" | "businessTrips";
type SortDir = "asc" | "desc";

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
      <span className="opacity-60">{icon}</span>
      {label}
      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{count}</Badge>
    </div>
  );
}

function UserDetailPanel({ email, onAction }: { email: string; onAction: () => void }) {
  const { data, isLoading } = useGetAdminUserDetail(encodeURIComponent(email));
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<"block" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-3 bg-muted/30">
        {[0,1,2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
    );
  }
  if (!data) return null;

  const { profile, groups, groupMemberships, expenses, settlements, ietExpenses, businessTrips, isBlocked, lastLoginAt } = data;

  async function handleBlock() {
    setBusy(true);
    try {
      await adminFetch(`/admin/users/${encodeURIComponent(email)}/block`, {
        method: "POST",
        body: JSON.stringify({ reason: "Blocked by admin" }),
      });
      toast({ title: "User blocked", description: email });
      await qc.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      onAction();
    } catch (e: unknown) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function handleUnblock() {
    setBusy(true);
    try {
      await adminFetch(`/admin/users/${encodeURIComponent(email)}/unblock`, { method: "POST" });
      toast({ title: "User unblocked", description: email });
      await qc.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      onAction();
    } catch (e: unknown) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await adminFetch(`/admin/users/${encodeURIComponent(email)}`, { method: "DELETE" });
      toast({ title: "User deleted", description: email });
      await qc.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      onAction();
    } catch (e: unknown) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function handleExport() {
    try {
      const res = await adminFetch(`/admin/users/${encodeURIComponent(email)}/export`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-export-${email}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export started", description: `${email}.json downloaded` });
    } catch (e: unknown) {
      toast({ title: "Export failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="bg-muted/20 border-t">
      {/* ── Admin Actions bar ── */}
      <div className="flex items-center gap-2 px-6 py-3 border-b bg-background/60 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-2">
          <Shield className="h-3.5 w-3.5" /> Admin Actions:
        </div>

        {isBlocked ? (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-green-600 border-green-200 hover:bg-green-50" onClick={handleUnblock} disabled={busy}>
            <ShieldCheck className="h-3.5 w-3.5" /> Unblock User
          </Button>
        ) : confirm === "block" ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Block {email}?</span>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleBlock} disabled={busy}>Confirm Block</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirm(null)}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => setConfirm("block")} disabled={busy}>
            <ShieldOff className="h-3.5 w-3.5" /> Block User
          </Button>
        )}

        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleExport} disabled={busy}>
          <Download className="h-3.5 w-3.5" /> Export Data
        </Button>

        {confirm === "delete" ? (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-muted-foreground">Permanently delete {email}?</span>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDelete} disabled={busy}>Confirm Delete</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirm(null)}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto" onClick={() => setConfirm("delete")} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" /> Delete Account
          </Button>
        )}
      </div>

      {/* ── Data grid ── */}
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Profile */}
        <div>
          <SectionHeader icon={<User className="h-3 w-3" />} label="Profile" count={profile.name ? 1 : 0} />
          {lastLoginAt && (
            <p className="text-xs text-muted-foreground mb-2">
              Last login: <span className="font-medium text-foreground">{format(new Date(lastLoginAt), "dd MMM yyyy HH:mm")}</span>
            </p>
          )}
          {profile.name || profile.upiId || profile.travelStyle ? (
            <dl className="text-sm space-y-1">
              {profile.name && <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Name</dt><dd className="font-medium">{profile.name}</dd></div>}
              {profile.upiId && <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">UPI ID</dt><dd className="font-mono text-xs">{profile.upiId}</dd></div>}
              {profile.travelStyle && <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Travel style</dt><dd>{profile.travelStyle}</dd></div>}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground italic">No profile set up yet.</p>
          )}
        </div>

        {/* Groups owned */}
        <div>
          <SectionHeader icon={<UsersIcon className="h-3 w-3" />} label="Groups owned" count={groups.length} />
          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No groups created.</p>
          ) : (
            <ul className="space-y-1">
              {groups.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-sm">
                  <span>{g.emoji}</span>
                  <span className="font-medium truncate max-w-[140px]">{g.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">{format(new Date(g.createdAt), "dd MMM yy")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Group memberships */}
        <div>
          <SectionHeader icon={<UsersIcon className="h-3 w-3" />} label="Group memberships" count={groupMemberships.length} />
          {groupMemberships.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Not in any other groups.</p>
          ) : (
            <ul className="space-y-1">
              {groupMemberships.map((m, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground truncate max-w-[120px]">{m.groupName}</span>
                  <span className="text-xs">→</span>
                  <span className="font-medium truncate">{m.memberName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Group Expenses */}
        <div>
          <SectionHeader icon={<CreditCard className="h-3 w-3" />} label="Group Expenses" count={expenses.length} />
          {expenses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No group expenses.</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="truncate max-w-[100px] font-medium">{e.title}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{e.groupName}</Badge>
                  <span className="ml-auto shrink-0 font-mono text-xs">₹{e.amount.toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          )}
          {expenses.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Total: ₹{expenses.reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}
            </p>
          )}
        </div>

        {/* Settlements */}
        <div>
          <SectionHeader icon={<CreditCard className="h-3 w-3" />} label="Settlements" count={settlements.length} />
          {settlements.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No settlements recorded.</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {settlements.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{s.mode}</Badge>
                  <span className="text-muted-foreground truncate max-w-[90px]">{s.groupName}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs">₹{s.amount.toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          )}
          {settlements.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Total: ₹{settlements.reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}
            </p>
          )}
        </div>

        {/* IET Expenses */}
        <div>
          <SectionHeader icon={<Receipt className="h-3 w-3" />} label="IET Expenses" count={ietExpenses.length} />
          {ietExpenses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No personal expenses tracked.</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {ietExpenses.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="truncate max-w-[120px] font-medium">{e.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs">₹{e.amount.toLocaleString("en-IN")}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{e.category}</Badge>
                </li>
              ))}
            </ul>
          )}
          {ietExpenses.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Total: ₹{ietExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}
            </p>
          )}
        </div>

        {/* Business Trips */}
        <div>
          <SectionHeader icon={<Briefcase className="h-3 w-3" />} label="Business Trips" count={businessTrips.length} />
          {businessTrips.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No business trips.</p>
          ) : (
            <ul className="space-y-1">
              {businessTrips.map((t) => (
                <li key={t.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate max-w-[140px]">{t.name}</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">{t.billCount} bills</Badge>
                  </div>
                  {t.destination && (
                    <div className="text-xs text-muted-foreground">
                      {t.destination} · {t.startDate}{t.endDate ? ` → ${t.endDate}` : ""}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityBadges({ groups, iet, trips, isBlocked }: { groups: number; iet: number; trips: number; isBlocked: boolean }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {isBlocked && (
        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded px-1.5 py-0.5 font-medium border border-red-200">
          <ShieldOff className="h-3 w-3" /> blocked
        </span>
      )}
      {groups > 0 && (
        <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
          <UsersIcon className="h-3 w-3" />{groups}g
        </span>
      )}
      {iet > 0 && (
        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 rounded px-1.5 py-0.5">
          <Receipt className="h-3 w-3" />{iet}e
        </span>
      )}
      {trips > 0 && (
        <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 rounded px-1.5 py-0.5">
          <Briefcase className="h-3 w-3" />{trips}t
        </span>
      )}
      {!isBlocked && groups === 0 && iet === 0 && trips === 0 && (
        <span className="text-xs text-muted-foreground">No activity</span>
      )}
    </div>
  );
}

export default function Users() {
  const { data: users, isLoading } = useGetAdminUsers();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    if (!users) return [];
    let result = users;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((u) => u.email.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "email") cmp = a.email.localeCompare(b.email);
      else if (sortField === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === "groupsOwned") cmp = a.groupsOwned - b.groupsOwned;
      else if (sortField === "ietExpenses") cmp = a.ietExpenses - b.ietExpenses;
      else if (sortField === "businessTrips") cmp = a.businessTrips - b.businessTrips;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [users, search, sortField, sortDir]);

  const toggleExpand = (email: string) => setExpandedEmail((prev) => (prev === email ? null : email));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Click any row to expand full details and admin actions.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("email")}>
                  <div className="flex items-center gap-1">Email <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("createdAt")}>
                  <div className="flex items-center gap-1">Joined <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead>Status &amp; Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [0,1,2,3,4].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No users found.</TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => {
                  const isExpanded = expandedEmail === user.email;
                  return (
                    <React.Fragment key={user.id}>
                      <TableRow
                        className={`cursor-pointer hover:bg-muted/40 transition-colors ${user.isBlocked ? "bg-red-50/30" : ""}`}
                        onClick={() => toggleExpand(user.email)}
                      >
                        <TableCell className="text-muted-foreground py-3">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{user.id}</TableCell>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(user.createdAt), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <ActivityBadges groups={user.groupsOwned} iet={user.ietExpenses} trips={user.businessTrips} isBlocked={user.isBlocked} />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="p-0">
                            <UserDetailPanel email={user.email} onAction={() => setExpandedEmail(null)} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
