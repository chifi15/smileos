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
  Filter,
  ArrowRightLeft,
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
import { useClinicFeatures } from "@/hooks/useSettings";
import type { UserRole } from "@/types";
import type { FeatureName } from "@/hooks/useSettings";

// ─── Nav definition ───────────────────────────────────────────────────────────

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
      { label: "Segmentación", href: "/patients/segments", icon: Filter },
      { label: "Smile Rewards", href: "/rewards", icon: Star, feature: "rewards" as FeatureName },
      { label: "Finanzas", href: "/finances", icon: TrendingUp, feature: "finances" as FeatureName },
      { label: "Costos", href: "/costos", icon: Calculator, feature: "costos" as FeatureName },
      { label: "Inventario", href: "/inventario", icon: Package, feature: "inventario" as FeatureName },
    ],
  },
  {
    section: "Reportes",
    items: [{ label: "Reportes", href: "/reportes", icon: BarChart2, feature: "reportes" as FeatureName }],
  },
  {
    section: "Sistema",
    items: [
      { label: "Actividad", href: "/actividad", icon: Activity, feature: "actividad" as FeatureName },
      { label: "Configuración", href: "/settings", icon: Settings },
    ],
  },
];

type NavItem = (typeof NAV_DEF)[0]["items"][0] & { roles?: UserRole[]; feature?: FeatureName };

// ─── Preferences ──────────────────────────────────────────────────────────────

const PREFS_KEY = "smileos-sidebar-prefs-v1";
const DEFAULT_ORDER = NAV_DEF.map((s) => s.section);
const ALL_HREFS = new Set(NAV_DEF.flatMap((s) => s.items.map((i) => i.href)));

interface SidebarPrefs {
  order: string[];
  collapsed: string[];
  hidden: string[];
  defaultExpanded: boolean;
  itemOrder: Record<string, string[]>;
  hiddenItems: string[];
  /** Overrides de sección: href → sección destino (si fue movido) */
  itemSection: Record<string, string>;
}

const EMPTY_PREFS: SidebarPrefs = {
  order: DEFAULT_ORDER,
  collapsed: [],
  hidden: [],
  defaultExpanded: true,
  itemOrder: {},
  hiddenItems: [],
  itemSection: {},
};

function loadPrefs(): SidebarPrefs {
  if (typeof window === "undefined") return EMPTY_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return EMPTY_PREFS;
    const p = JSON.parse(raw) as Partial<SidebarPrefs>;
    const allSections = new Set(DEFAULT_ORDER);

    const order = (p.order ?? DEFAULT_ORDER).filter((s) => allSections.has(s));
    for (const s of DEFAULT_ORDER) if (!order.includes(s)) order.push(s);

    const itemOrder: Record<string, string[]> = {};
    for (const { section } of NAV_DEF) {
      const saved = ((p.itemOrder ?? {})[section] ?? []).filter((h) => ALL_HREFS.has(h));
      itemOrder[section] = saved;
    }

    const itemSection: Record<string, string> = {};
    for (const [href, section] of Object.entries(p.itemSection ?? {})) {
      if (ALL_HREFS.has(href) && allSections.has(section as string)) {
        itemSection[href] = section as string;
      }
    }

    return {
      order,
      collapsed: (p.collapsed ?? []).filter((s) => allSections.has(s)),
      hidden: (p.hidden ?? []).filter((s) => allSections.has(s)),
      defaultExpanded: p.defaultExpanded !== false,
      itemOrder,
      hiddenItems: (p.hiddenItems ?? []).filter((h) => ALL_HREFS.has(h)),
      itemSection,
    };
  } catch {
    return EMPTY_PREFS;
  }
}

function savePrefs(prefs: SidebarPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ─── Sortable item row (edit mode) ────────────────────────────────────────────

function SortableItemRow({
  item,
  isHidden,
  onToggleHide,
  sections,
  currentSection,
  onMoveToSection,
}: {
  item: NavItem;
  isHidden: boolean;
  onToggleHide: (href: string) => void;
  sections: string[];
  currentSection: string;
  onMoveToSection: (href: string, section: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.href });
  const [showMove, setShowMove] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const Icon = item.icon;
  const otherSections = sections.filter((s) => s !== currentSection);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex items-center gap-1.5 rounded-lg pl-5 pr-2 py-1.5",
        isHidden ? "opacity-30" : ""
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-white/25 hover:text-white/55 transition-colors shrink-0"
        aria-label="Arrastrar"
      >
        <GripVertical size={13} />
      </button>
      <Icon size={14} strokeWidth={1.8} className="shrink-0 text-white/45" />
      <span className="flex-1 text-xs text-white/65">{item.label}</span>

      {/* Mover a sección */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowMove((v) => !v)}
          className="rounded p-0.5 text-white/20 hover:text-blue-400 transition-colors"
          title="Mover a sección"
        >
          <ArrowRightLeft size={11} />
        </button>
        {showMove && (
          <div className="absolute right-0 bottom-full mb-1 z-50 bg-[#162d4a] border border-white/15 rounded-lg shadow-lg overflow-hidden min-w-[110px]">
            {otherSections.map((s) => (
              <button
                key={s}
                onClick={() => { onMoveToSection(item.href, s); setShowMove(false); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                → {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => onToggleHide(item.href)}
        className={cn(
          "rounded p-0.5 transition-colors shrink-0",
          isHidden ? "text-white/30 hover:text-white/60" : "text-white/25 hover:text-red-400"
        )}
        title={isHidden ? "Mostrar" : "Ocultar"}
      >
        {isHidden ? <EyeOff size={12} /> : <X size={12} />}
      </button>
    </div>
  );
}

// ─── Sortable section block (edit mode) ───────────────────────────────────────

function SortableSectionBlock({
  section,
  orderedItems,
  isHidden,
  hiddenItems,
  allSections,
  onToggleHideSection,
  onToggleHideItem,
  onItemDragEnd,
  onMoveItemToSection,
  sensors,
}: {
  section: string;
  orderedItems: NavItem[];
  isHidden: boolean;
  hiddenItems: string[];
  allSections: string[];
  onToggleHideSection: (s: string) => void;
  onToggleHideItem: (href: string) => void;
  onItemDragEnd: (event: DragEndEvent) => void;
  onMoveItemToSection: (href: string, section: string) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-0.5">
      {/* Section header */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5",
          isHidden ? "opacity-40" : ""
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-white/30 hover:text-white/60 transition-colors shrink-0"
          aria-label="Arrastrar sección"
        >
          <GripVertical size={15} />
        </button>
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-white/55">
          {section}
        </span>
        <button
          onClick={() => onToggleHideSection(section)}
          className={cn(
            "rounded p-1 transition-colors shrink-0",
            isHidden ? "text-white/30 hover:text-white/60" : "text-white/35 hover:text-red-400"
          )}
          title={isHidden ? "Mostrar sección" : "Ocultar sección"}
        >
          {isHidden ? <EyeOff size={13} /> : <X size={13} />}
        </button>
      </div>

      {/* Items (nested sortable) */}
      {!isHidden && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onItemDragEnd}
        >
          <SortableContext
            items={orderedItems.map((i) => i.href)}
            strategy={verticalListSortingStrategy}
          >
            {orderedItems.map((item) => (
              <SortableItemRow
                key={item.href}
                item={item}
                isHidden={hiddenItems.includes(item.href)}
                onToggleHide={onToggleHideItem}
                sections={allSections}
                currentSection={section}
                onMoveToSection={onMoveItemToSection}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const logout = useLogout();
  const { theme, setTheme } = useTheme();

  const { data: enabledFeatures } = useClinicFeatures();
  const [prefs, setPrefs] = useState<SidebarPrefs>(EMPTY_PREFS);
  const [editMode, setEditMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!editMode) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setEditMode(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function updatePrefs(next: SidebarPrefs) {
    setPrefs(next);
    savePrefs(next);
  }

  // ── Section helpers ──

  function isSectionCollapsed(section: string) {
    const inList = prefs.collapsed.includes(section);
    return prefs.defaultExpanded ? inList : !inList;
  }

  function toggleCollapse(section: string) {
    const inList = prefs.collapsed.includes(section);
    const collapsed = inList
      ? prefs.collapsed.filter((s) => s !== section)
      : [...prefs.collapsed, section];
    updatePrefs({ ...prefs, collapsed });
  }

  function toggleDefaultExpanded() {
    updatePrefs({ ...prefs, defaultExpanded: !prefs.defaultExpanded, collapsed: [] });
  }

  function toggleHideSection(section: string) {
    const hidden = prefs.hidden.includes(section)
      ? prefs.hidden.filter((s) => s !== section)
      : [...prefs.hidden, section];
    updatePrefs({ ...prefs, hidden });
  }

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = prefs.order.indexOf(active.id as string);
    const newIdx = prefs.order.indexOf(over.id as string);
    updatePrefs({ ...prefs, order: arrayMove(prefs.order, oldIdx, newIdx) });
  }

  // ── Item helpers ──

  function getOrderedItems(section: string): NavItem[] {
    // ítems que pertenecen a esta sección (por default o por override)
    const allItems = NAV_DEF.flatMap((s) => s.items) as NavItem[];
    const sectionItems = allItems.filter((i) => {
      const override = prefs.itemSection[i.href];
      return override ? override === section : NAV_DEF.find((s) => s.section === section)?.items.some((si) => si.href === i.href);
    });
    const defaultOrder = sectionItems.map((i) => i.href);
    const savedOrder = (prefs.itemOrder[section] ?? []).filter((h) => sectionItems.some((i) => i.href === h));
    // añadir los que no estén en savedOrder (recién movidos)
    const merged = [...new Set([...savedOrder, ...defaultOrder])];
    return merged.map((href) => sectionItems.find((i) => i.href === href)).filter(Boolean) as NavItem[];
  }

  function moveItemToSection(href: string, targetSection: string) {
    const newItemSection = { ...prefs.itemSection, [href]: targetSection };
    // limpiar el href del itemOrder de la sección anterior
    const newItemOrder: Record<string, string[]> = {};
    for (const [sec, order] of Object.entries(prefs.itemOrder)) {
      newItemOrder[sec] = order.filter((h) => h !== href);
    }
    updatePrefs({ ...prefs, itemSection: newItemSection, itemOrder: newItemOrder });
  }

  function toggleHideItem(href: string) {
    const hiddenItems = prefs.hiddenItems.includes(href)
      ? prefs.hiddenItems.filter((h) => h !== href)
      : [...prefs.hiddenItems, href];
    updatePrefs({ ...prefs, hiddenItems });
  }

  function handleItemDragEnd(section: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = getOrderedItems(section).map((i) => i.href);
    const oldIdx = current.indexOf(active.id as string);
    const newIdx = current.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    updatePrefs({
      ...prefs,
      itemOrder: { ...prefs.itemOrder, [section]: arrayMove(current, oldIdx, newIdx) },
    });
  }

  function resetPrefs() {
    updatePrefs(EMPTY_PREFS);
  }

  // ── Derived data ──

  const orderedSections = prefs.order
    .map((name) => NAV_DEF.find((s) => s.section === name))
    .filter(Boolean) as typeof NAV_DEF;

  const visibleSections = orderedSections.filter((s) => !prefs.hidden.includes(s.section));

  const initials = user?.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const hiddenItemCount = prefs.hiddenItems.length;
  const hiddenSectionCount = prefs.hidden.length;

  if (!mounted) {
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
      <nav className="flex-1 overflow-y-auto py-4 px-3">

        {/* ── Normal mode ── */}
        {!editMode && (
          <div className="space-y-1">
            {visibleSections.map(({ section }) => {
              const isCollapsed = isSectionCollapsed(section);
              const items = getOrderedItems(section).filter(
                (i) =>
                  !prefs.hiddenItems.includes(i.href) &&
                  (!i.roles || i.roles.includes(user?.role as UserRole)) &&
                  (!i.feature || enabledFeatures?.includes(i.feature))
              );
              return (
                <div key={section} className="mb-1">
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

                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {items.map(({ label, href, icon: Icon }) => {
                        const active =
                          pathname === href || pathname.startsWith(href + "/");
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

            {(hiddenSectionCount > 0 || hiddenItemCount > 0) && (
              <p className="px-3 pt-1 text-[10px] text-white/25">
                {[
                  hiddenSectionCount > 0 &&
                    `${hiddenSectionCount} sección${hiddenSectionCount > 1 ? "es" : ""} oculta${hiddenSectionCount > 1 ? "s" : ""}`,
                  hiddenItemCount > 0 &&
                    `${hiddenItemCount} ítem${hiddenItemCount > 1 ? "s" : ""} oculto${hiddenItemCount > 1 ? "s" : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        )}

        {/* ── Edit mode ── */}
        {editMode && (
          <div className="space-y-0.5">
            <p className="px-2 py-1 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              ⠿ Arrastra · ✕ Oculta
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSectionDragEnd}
            >
              <SortableContext items={prefs.order} strategy={verticalListSortingStrategy}>
                {prefs.order.map((section) => (
                  <SortableSectionBlock
                    key={section}
                    section={section}
                    orderedItems={getOrderedItems(section).filter(
                      (i) =>
                        (!i.roles || i.roles.includes(user?.role as UserRole)) &&
                        (!i.feature || enabledFeatures?.includes(i.feature))
                    )}
                    isHidden={prefs.hidden.includes(section)}
                    hiddenItems={prefs.hiddenItems}
                    allSections={prefs.order}
                    onToggleHideSection={toggleHideSection}
                    onToggleHideItem={toggleHideItem}
                    onItemDragEnd={(e) => handleItemDragEnd(section, e)}
                    onMoveItemToSection={moveItemToSection}
                    sensors={sensors}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Expandidas por defecto */}
            <div className="mt-3 flex items-center justify-between rounded-lg px-3 py-2 bg-white/5">
              <div>
                <p className="text-xs font-medium text-white/70">Expandidas por defecto</p>
                <p className="text-[10px] text-white/35 mt-0.5">
                  {prefs.defaultExpanded
                    ? "Las secciones abren al cargar"
                    : "Las secciones cierran al cargar"}
                </p>
              </div>
              <button
                onClick={toggleDefaultExpanded}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                  prefs.defaultExpanded ? "bg-blue-500" : "bg-white/20"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                    prefs.defaultExpanded ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            <button
              onClick={resetPrefs}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
            >
              <RotateCcw size={13} />
              Restaurar por defecto
            </button>
          </div>
        )}
      </nav>

      {/* Personalizar / Hecho */}
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
