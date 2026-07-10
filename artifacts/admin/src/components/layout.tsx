import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Map, CreditCard, LogOut, Activity, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border font-bold text-lg tracking-tight uppercase">
          Qontri Admin
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            <NavItem href="/analytics" icon={<LayoutDashboard size={18} />} label="Analytics" />
            <NavItem href="/users" icon={<Users size={18} />} label="User Management" />
            <NavItem href="/performance" icon={<Activity size={18} />} label="Performance" />
            <NavItem href="/audit-logs" icon={<ClipboardList size={18} />} label="Audit Logs" />
            <li className="my-1 border-t border-sidebar-border opacity-30" />
            <NavItem href="/trips" icon={<Map size={18} />} label="Legacy Trips" />
            <NavItem href="/expenses" icon={<CreditCard size={18} />} label="Expenses" />
          </ul>
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-accent rounded-md transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const [location] = useLocation();
  const isActive = location === href || location.startsWith(`${href}/`);

  return (
    <li>
      <Link href={href}>
        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            isActive
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          {icon}
          {label}
        </div>
      </Link>
    </li>
  );
}
