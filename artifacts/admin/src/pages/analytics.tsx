import { useGetAdminAnalytics } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Users, ShieldOff, ShieldCheck, Activity, CalendarPlus, AlertCircle,
  Layers, Receipt, Briefcase, TrendingUp, Sun, Sunset, Moon, CheckCircle2,
  TriangleAlert, Clock,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good Morning", Icon: Sun };
  if (h < 17) return { text: "Good Afternoon", Icon: Sunset };
  return { text: "Good Evening", Icon: Moon };
}

function formatRupees(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} lakh`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${Math.round(amount)}`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Analytics() {
  const { data: a, isLoading, error } = useGetAdminAnalytics();
  const [activeTab, setActiveTab] = useState<"today" | "week">("today");

  if (error) {
    return (
      <Layout>
        <div className="p-6 bg-destructive/10 text-destructive rounded-md flex items-center gap-3 border border-destructive/20">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load analytics data. Ensure you are authorized.</span>
        </div>
      </Layout>
    );
  }

  const { text: greetText, Icon: GreetIcon } = getGreeting();
  const isHealthy = !a || (a.serverErrors < 5 && a.blockedUsers === 0);

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
          <p className="text-muted-foreground mt-1">Live metrics for the Qontri ecosystem.</p>
        </div>

        {isLoading || !a ? (
          <div className="space-y-4">
            <Skeleton className="h-52 w-full rounded-xl" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Today's Summary ── */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
              <CardContent className="pt-6 pb-5">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <GreetIcon className="h-5 w-5 text-amber-500" />
                      <span className="text-lg font-semibold text-muted-foreground">{greetText}, Adarsh 👋</span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Today's Summary</h2>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${isHealthy ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
                    {isHealthy
                      ? <><CheckCircle2 className="h-4 w-4" /> Everything looks healthy</>
                      : <><TriangleAlert className="h-4 w-4" /> Attention needed</>}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SummaryTile label="New users joined" value={a.newUsersToday} suffix="users" color="blue" />
                  <SummaryTile label="Expenses added" value={a.expensesToday} suffix="expenses" color="violet" />
                  <SummaryTile label="Amount settled" value={formatRupees(a.settledAmountToday)} color="green" />
                  <SummaryTile label="Users active" value={a.dau} suffix="opened app" color="amber" />
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SummaryTile label="Personal finance" value={a.ietToday} suffix="entries" color="violet" />
                  <SummaryTile
                    label="Server uptime"
                    value={formatUptime(a.uptimeSeconds)}
                    color="green"
                  />
                  <SummaryTile
                    label="Server errors"
                    value={a.serverErrors}
                    suffix="since restart"
                    color={a.serverErrors > 0 ? "red" : "green"}
                  />
                  <SummaryTile label="Revenue today" value="₹0" sub="payments not yet enabled" color="muted" />
                </div>
              </CardContent>
            </Card>

            {/* ── Row 1: User counts ── */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">User Overview</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard icon={<Users className="h-4 w-4" />} title="Total Users" value={a.totalUsers} sub="all time" color="blue" />
                <MetricCard icon={<CalendarPlus className="h-4 w-4" />} title="New Today" value={a.newUsersToday} sub={`+${a.newUsersThisWeek} this week`} color="green" />
                <MetricCard icon={<ShieldCheck className="h-4 w-4" />} title="Verified" value={a.verifiedUsers} sub="profile set up" color="violet" />
                <MetricCard icon={<ShieldOff className="h-4 w-4" />} title="Blocked" value={a.blockedUsers} sub="accounts blocked" color={a.blockedUsers > 0 ? "red" : "muted"} />
              </div>
            </section>

            {/* ── Row 2: Active users counts ── */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Active Users</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard icon={<Activity className="h-4 w-4" />} title="Daily Active (DAU)" value={a.dau} sub="opened app today" color="amber" />
                <MetricCard icon={<Activity className="h-4 w-4" />} title="Weekly Active (WAU)" value={a.wau} sub="last 7 days" color="amber" />
                <MetricCard icon={<Activity className="h-4 w-4" />} title="Monthly Active (MAU)" value={a.mau} sub="last 30 days" color="amber" />
              </div>
            </section>

            {/* ── Active users list ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Who's Been Active
                    </CardTitle>
                    <CardDescription className="mt-1">Users who opened the app</CardDescription>
                  </div>
                  <div className="flex gap-1 p-1 bg-muted rounded-lg">
                    <button
                      onClick={() => setActiveTab("today")}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${activeTab === "today" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Today ({a.dauUsers?.length ?? 0})
                    </button>
                    <button
                      onClick={() => setActiveTab("week")}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${activeTab === "week" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      This Week ({a.wauUsers?.length ?? 0})
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {((activeTab === "today" ? a.dauUsers : a.wauUsers) ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No activity recorded yet. Users need to open the app to appear here.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                    {((activeTab === "today" ? a.dauUsers : a.wauUsers) ?? []).map((u, i) => (
                      <div key={u.email} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {u.email[0]?.toUpperCase() ?? "?"}
                          </div>
                          <span className="text-sm font-medium truncate max-w-[260px]">{u.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {i === 0 && activeTab === "today" && (
                            <Badge variant="secondary" className="text-[10px] py-0">latest</Badge>
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(u.lastSeen)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Row 3: Platform data ── */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Platform Activity</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard icon={<Layers className="h-4 w-4" />} title="Total Groups" value={a.totalGroups} sub="groups created" color="blue" />
                <MetricCard icon={<Receipt className="h-4 w-4" />} title="IET Expenses" value={a.totalIetExpenses} sub="personal expenses tracked" color="green" />
                <MetricCard icon={<Briefcase className="h-4 w-4" />} title="Business Trips" value={a.totalBusinessTrips} sub="trips logged" color="violet" />
              </div>
            </section>

            {/* ── Charts ── */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    User Signups (30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={a.signupsByDay}>
                        <defs>
                          <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{fontSize: 11}} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{fontSize: 11}} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                        <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorUsers)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Group Owners</CardTitle>
                  <CardDescription>Users who have created the most groups</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {a.topGroupOwners.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No groups created yet.</p>
                    ) : (
                      a.topGroupOwners.map((owner, i) => (
                        <div key={owner.email} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground border">
                              {i + 1}
                            </div>
                            <span className="font-medium text-sm truncate max-w-[200px]">{owner.email}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            <span className="font-bold text-foreground">{owner.groupCount}</span> groups
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

type ColorName = "blue" | "green" | "violet" | "amber" | "red" | "muted";

const colorMap: Record<ColorName, { bg: string; text: string }> = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/30",   text: "text-blue-600 dark:text-blue-400" },
  green:  { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600 dark:text-violet-400" },
  amber:  { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400" },
  red:    { bg: "bg-red-50 dark:bg-red-950/30",     text: "text-red-600 dark:text-red-400" },
  muted:  { bg: "bg-muted/40",                       text: "text-muted-foreground" },
};

function MetricCard({
  icon, title, value, sub, color = "blue", note,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  sub: string;
  color?: ColorName;
  note?: string;
}) {
  const c = colorMap[color];
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            {note && <p className="text-[10px] text-muted-foreground/60 mt-1 italic">{note}</p>}
          </div>
          <div className={`p-2 rounded-lg ${c.bg} ${c.text}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  label, value, suffix, color = "blue", sub,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  color?: ColorName;
  sub?: string;
}) {
  const c = colorMap[color];
  return (
    <div className={`rounded-xl px-4 py-3 ${c.bg}`}>
      <p className={`text-2xl font-bold tracking-tight ${c.text}`}>
        {value}
        {suffix && <span className="text-sm font-normal ml-1 opacity-70">{suffix}</span>}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}
