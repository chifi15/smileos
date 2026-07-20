"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  Camera,
  Star,
  Settings,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { useLogout } from "@/hooks/useAuth";

const NAV = [
  {
    section: "Principal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Pacientes", href: "/patients", icon: Users },
    ],
  },
  {
    section: "Clínica",
    items: [
      { label: "Agenda", href: "/appointments", icon: Calendar },
      { label: "Tratamientos", href: "/treatments", icon: ClipboardList },
      { label: "Fotografías", href: "/photos", icon: Camera },
      { label: "Smile Rewards", href: "/rewards", icon: Star },
      { label: "Finanzas", href: "/finances", icon: TrendingUp },
    ],
  },
  {
    section: "Sistema",
    items: [
      { label: "Configuración", href: "/settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const logout = useLogout();

  const initials = user?.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-[#1e3a5f] text-white">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-white/10">
        <span className="text-xl font-bold tracking-tight">
          Smile<span className="text-blue-400">OS</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              {section}
            </p>
            {items.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{user?.full_name}</p>
            <p className="truncate text-xs text-white/50">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={15} strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
