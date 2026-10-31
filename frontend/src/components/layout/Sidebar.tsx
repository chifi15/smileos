"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
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
  Calculator,
  Activity,
  Package,
  Sun,
  Moon,
  BarChart2,
  ChevronDown,
  GripVertical,
  X,
  EyeOff,
  RotateCcw,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { useLogout } from "@/hooks/useAuth";

const NAV_DEF = [
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
      { label: "Costos", href: "/costos", icon: Calculator },
      { label: "Inventario", href: "/inventario", icon: Package },
    ],
  },
  {
    section: "Reportes",
    items: [
      { label: "Reportes", href: "/reportes", icon: BarChart2 },
    ],
  },
  {
    section: "Sistema",
    items: [
      { label: "Actividad", href: "/actividad", icon: Activity },
      { label: "Configuración", href: "/settings", icon: Settings },
    ],
  },
];

const PREFS_KEY = "smileos-sidebar-prefs-v1";
const DEFAULT_ORDER = NAV_DEF.map((s) => s.section);

interface SidebarPrefs {
  order: string[];
  collapsed: string[];
  hidden: string[];
}

function loadPrefs(): SidebarPrefs {
  if (typeof window === "undefined") return { order: DEFAULT_ORDER, collapsed: [], hidden: [] };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { order: DEFAULT_ORDER, collapsed: [], hidden: [] };
    const parsed = JSON.parse(raw) as Partial<SidebarPrefs>;
    const allSections = new Set(DEFAULT_ORDER);
    const order = (parsed.order ?? DEFAULT_ORDER).filter((s) => allSections.has(s));
    // append any new sections not in saved order
    for (const s of DEFAULT_ORDER) if (!order.includes(s)) order.push(s);
    return {
      order,
      collapsed: (parsed.collapsed ?? []).filter((s) => allSections.has(s)),
      hidden: (parsed.hidden ?? []).filter((s) => allSections.has(s)),
    };
  } catch {
    return { order: DEFAULT_ORDER, collapsed: [], hidden: [] };
  }
}

function savePrefs(prefs: SidebarPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ─── Sortable section row (edit mode) ────────────────────────────────────────

function SortableSectionRow({
  section,
  isHidden,
  onToggleHide,
}: {
  section: string;
  isHidden: boolean;
  onToggleHide: (s: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-2 text-sm",
        isHidden ? "text-white/30" : "text-white/80"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-white/30 hover:text-white/60 transition-colors"
        aria-label="Arrastrar"
      >
        <GripVertical size={16} />
      </button>
      <span className="flex-1 font-medium">{section}</span>
      <button
        onClick={() => onToggleHide(section)}
        className={cn(
          "rounded p-1 transition-colors",
          isHidden
            ? "text-white/30 hover:text-white/60"
            : "text-white/40 hover:text-red-400"
        )}
        title={isHidden ? "Mostrar sección" : "Ocultar sección"}
      >
        {isHidden ? <EyeOff size={14} /> : <X size={14} />}
      </button>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const logout = useLogout();
  const { theme, setTheme } = useTheme();

  const [prefs, setPrefs] = useState<SidebarPrefs>({ order: DEFAULT_ORDER, collapsed: [], hidden: [] });
  const [editMode, setEditMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setMounted(true);
  }, []);

  function updatePrefs(next: SidebarPrefs) {
    setPrefs(next);
    savePrefs(next);
  }

  function toggleCollapse(section: string) {
    const collapsed = prefs.collapsed.includes(section)
      ? prefs.collapsed.filter((s) => s !== section)
      : [...prefs.collapsed, section];
    updatePrefs({ ...prefs, collapsed });
  }

  function toggleHide(section: string) {
    const hidden = prefs.hidden.includes(section)
      ? prefs.hidden.filter((s) => s !== section)
      : [...prefs.hidden, section];
    updatePrefs({ ...prefs, hidden });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = prefs.order.indexOf(active.id as string);
    const newIndex = prefs.order.indexOf(over.id as string);
    const order = arrayMove(prefs.order, oldIndex, newIndex);
    updatePrefs({ ...prefs, order });
  }

  function resetPrefs() {
    const fresh = { order: DEFAULT_ORDER, collapsed: [], hidden: [] };
    updatePrefs(fresh);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const initials = user?.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Build ordered sections
  const orderedSections = prefs.order
    .map((name) => NAV_DEF.find((s) => s.section === name))
    .filter(Boolean) as typeof NAV_DEF;

  const visibleSections = orderedSections.filter((s) => !prefs.hidden.includes(s.section));
  const hasHidden = prefs.hidden.length > 0;

  if (!mounted) {
    // SSR / hydration — render static to avoid mismatch
    return (
      <aside className="flex w-60 shrink-0 flex-col bg-[#1e3a5f] text-white">
        <div className="flex h-16 items-center px-6 border-b border-white/10">
          <span className="text-xl font-bold tracking-tight">
            Smile<span className="text-blue-400">OS</span>
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-[#1e3a5f] text-white">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-white/10">
        <span className="text-xl font-bold tracking-tight">
          Smile<span className="text-blue-400">OS</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">

        {/* ── Normal mode ── */}
        {!editMode && (
          <>
            {visibleSections.map(({ section, items }) => {
              const isCollapsed = prefs.collapsed.includes(section);
              return (
                <div key={section} className="mb-1">
                  {/* Section header */}
                  <button
                    onClick={() => toggleCollapse(section)}
                    className="flex w-full items-center justify-between px-3 py-1 mb-1 group"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors">
                      {section}
                    </span>
                    <ChevronDown
                      size={12}
                      className={cn(
                        "text-white/30 group-hover:text-white/50 transition-all duration-200",
                        isCollapsed ? "-rotate-90" : "rotate-0"
                      )}
                    />
                  </button>

                  {/* Items */}
                  {!isCollapsed && (
                    <div className="space-y-0.5">
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
                  )}
                </div>
              );
            })}

            {/* Sections hidden indicator */}
            {hasHidden && (
              <p className="px-3 pt-2 text-[10px] text-white/25">
                {prefs.hidden.length} sección{prefs.hidden.length > 1 ? "es" : ""} oculta{prefs.hidden.length > 1 ? "s" : ""}
              </p>
            )}
          </>
        )}

        {/* ── Edit mode ── */}
        {editMode && (
          <div className="space-y-1">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Arrastrar para reordenar
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={prefs.order} strategy={verticalListSortingStrategy}>
                {prefs.order.map((section) => (
                  <SortableSectionRow
                    key={section}
                    section={section}
                    isHidden={prefs.hidden.includes(section)}
                    onToggleHide={toggleHide}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {hasHidden && (
              <div className="mt-2 px-2">
                <p className="text-[10px] text-white/30 mb-1 px-1">Secciones ocultas (click <EyeOff size={10} className="inline" /> para mostrar)</p>
              </div>
            )}

            <button
              onClick={resetPrefs}
              className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
            >
              <RotateCcw size={13} />
              Restaurar por defecto
            </button>
          </div>
        )}
      </nav>

      {/* Personalizar / Hecho button */}
      <div className="px-3 pb-1">
        <button
          onClick={() => setEditMode((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
            editMode
              ? "bg-blue-600 text-white hover:bg-blue-500"
              : "text-white/40 hover:bg-white/10 hover:text-white/70"
          )}
        >
          {editMode ? <Check size={13} /> : <SlidersHorizontal size={13} />}
          {editMode ? "Hecho" : "Personalizar menú"}
        </button>
      </div>

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
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        >
          {theme === "dark" ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </button>

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
