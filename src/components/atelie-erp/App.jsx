import React, { useState, useReducer, useMemo, useContext, createContext, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, Calculator, FileBarChart, Menu, X, Plus,
  Trash2, TrendingUp, TrendingDown, DollarSign, Search,
  Download, CheckCircle2, Clock, LogOut, Shield,
  ArrowUpRight, ArrowDownRight, ChevronRight, Truck, FileDown,
  Printer, PlusCircle, Calendar, FileText, ClipboardList, Ban, RotateCcw,
  Filter, AlertTriangle, ChevronLeft
} from "lucide-react";
import { hydrateState, persistAction, matchSearch } from "./persistence";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import * as XLSX from "xlsx";

/* ============================================================================
   TOKENS DE MARCA
   Paleta afetiva pensada para uma artesã: rosa envelhecido + terracota suave,
   remetendo a linha, tecido e papel — fácil de trocar para alinhar com a
   identidade visual da cliente no futuro.
============================================================================ */
const BRAND = {
  primary: "#C1577A",
  primaryDark: "#8E3B58",
  primaryLight: "#FCE9EF",
  primarySoft: "#F3BFD1",
  accent: "#C98A4B",
  accentLight: "#FBF1E3",
};

const BrandStyles = () => (
  <style>{`
    :root {
      --primary: ${BRAND.primary};
      --primary-dark: ${BRAND.primaryDark};
      --primary-light: ${BRAND.primaryLight};
      --primary-soft: ${BRAND.primarySoft};
      --accent: ${BRAND.accent};
      --accent-light: ${BRAND.accentLight};
    }
    .font-display { font-family: ui-serif, Georgia, 'Times New Roman', serif; }
    ::selection { background: var(--primary-soft); }
  `}</style>
);

/* ============================================================================
   FORMATADORES
============================================================================ */
const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
const fmtDate = (iso) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const monthLabel = (idx) =>
  ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][idx];
const uid = () => Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ============================================================================
   DADOS DO SISTEMA
   Sistema inicia zerado — sem dados de exemplo.
============================================================================ */
const CATEGORIES = ["Insumos", "Luz", "Água", "Internet", "Aluguel", "Transporte", "Marketing", "Venda de Produto", "Embalagens", "Outros"];
const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão de Débito", "Cartão de Crédito", "Boleto", "Transferência"];

/* ============================================================================
   ESTADO GLOBAL (Context + useReducer)
============================================================================ */
const StoreContext = createContext(null);
const useStore = () => useContext(StoreContext);

const initialState = {
  transactions: [],
  clients: [],
  suppliers: [],
  products: [],
  orcamentos: [],
  pedidos: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "ADD_TRANSACTION":
      return { ...state, transactions: [action.payload, ...state.transactions] };
    case "DELETE_TRANSACTION":
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.payload) };
    case "ADD_CLIENT":
      return { ...state, clients: [action.payload, ...state.clients] };
    case "DELETE_CLIENT":
      return { ...state, clients: state.clients.filter((c) => c.id !== action.payload) };
    case "ADD_SUPPLIER":
      return { ...state, suppliers: [action.payload, ...state.suppliers] };
    case "DELETE_SUPPLIER":
      return { ...state, suppliers: state.suppliers.filter((s) => s.id !== action.payload) };
    case "HYDRATE":
      return { ...state, ...action.payload };
    case "ADD_PRODUCT":
      return { ...state, products: [action.payload, ...state.products] };
    case "DELETE_PRODUCT":
      return { ...state, products: state.products.filter((p) => p.id !== action.payload) };
    case "ADD_ORCAMENTO":
      return { ...state, orcamentos: [action.payload, ...state.orcamentos] };
    case "DELETE_ORCAMENTO":
      return { ...state, orcamentos: state.orcamentos.filter((o) => o.id !== action.payload) };
    case "SET_ORCAMENTO_STATUS":
      return {
        ...state,
        orcamentos: state.orcamentos.map((o) =>
          o.id === action.payload.id ? { ...o, status: action.payload.status } : o
        ),
      };
    case "ADD_PEDIDO":
      return { ...state, pedidos: [action.payload, ...state.pedidos] };
    case "DELETE_PEDIDO":
      return { ...state, pedidos: state.pedidos.filter((p) => p.id !== action.payload) };
    case "SET_PEDIDO_STATUS":
      return {
        ...state,
        pedidos: state.pedidos.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload.patch } : p
        ),
      };
    default:
      return state;
  }
}

/* ============================================================================
   COMPONENTES BÁSICOS REUTILIZÁVEIS
============================================================================ */
const Card = ({ children, className = "", ...rest }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${className}`} {...rest}>
    {children}
  </div>
);

const SectionTitle = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-4 mb-5">
    <div>
      <h2 className="text-xl font-semibold text-slate-800 font-display">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const Button = ({ children, variant = "primary", className = "", ...rest }) => {
  const base = "inline-flex items-center gap-2 text-sm font-medium rounded-xl px-4 py-2.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "text-white shadow-sm hover:shadow-md",
    ghost: "text-slate-600 hover:bg-slate-100",
    outline: "border border-slate-200 text-slate-700 hover:bg-slate-50",
    danger: "text-red-600 hover:bg-red-50",
  };
  const style = variant === "primary" ? { backgroundColor: "var(--primary)" } : {};
  return (
    <button className={`${base} ${variants[variant]} ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
};

const Input = ({ label, className = "", ...rest }) => (
  <label className="block">
    {label && <span className="block text-xs font-medium text-slate-500 mb-1.5">{label}</span>}
    <input
      className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:bg-white focus:border-slate-300 focus:ring-2 ${className}`}
      style={{ "--tw-ring-color": "var(--primary-soft)" }}
      {...rest}
    />
  </label>
);

const Select = ({ label, children, className = "", ...rest }) => (
  <label className="block">
    {label && <span className="block text-xs font-medium text-slate-500 mb-1.5">{label}</span>}
    <select
      className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:bg-white focus:border-slate-300 focus:ring-2 ${className}`}
      style={{ "--tw-ring-color": "var(--primary-soft)" }}
      {...rest}
    >
      {children}
    </select>
  </label>
);

const Badge = ({ children, tone = "slate" }) => {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    primary: "text-white",
  };
  const style = tone === "primary" ? { backgroundColor: "var(--primary)" } : {};
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone]}`} style={style}>
      {children}
    </span>
  );
};

const EmptyState = ({ icon: Icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6">
    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: "var(--primary-light)" }}>
      <Icon size={20} style={{ color: "var(--primary)" }} />
    </div>
    <p className="text-sm font-medium text-slate-700">{title}</p>
    {subtitle && <p className="text-xs text-slate-400 mt-1 max-w-xs">{subtitle}</p>}
  </div>
);

/* ============================================================================
   SIDEBAR
============================================================================ */
const NAV_ITEMS = [
  { key: "dashboard", label: "Painel", icon: LayoutDashboard },
  { key: "cadastros", label: "Cadastros", icon: Users },
  { key: "orcamentos", label: "Orçamentos", icon: FileText },
  { key: "pedidos", label: "Pedidos", icon: ClipboardList },
  { key: "precificacao", label: "Precificação", icon: Calculator },
  { key: "relatorios", label: "Relatórios", icon: FileBarChart },
];

function AccountBadge({ userName, isAdmin, onSignOut, onOpenAdmin }) {
  const initials = userName
    ? userName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "";

  return (
    <div className="mt-3 space-y-1">
      <div className="w-full flex items-center gap-2.5 px-2 py-1 text-left">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ backgroundColor: userName ? "var(--primary)" : "#cbd5e1" }}
        >
          {initials || <Users size={13} />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate">{userName || "Minha conta"}</p>
          <p className="text-[11px] text-slate-400 truncate">{isAdmin ? "Administrador" : "Usuária"}</p>
        </div>
      </div>
      {isAdmin && (
        <button
          onClick={onOpenAdmin}
          className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        >
          <Shield size={14} /> Gerenciar usuários
        </button>
      )}
      <button
        onClick={onSignOut}
        className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600"
      >
        <LogOut size={14} /> Sair
      </button>
    </div>
  );
}

function Sidebar({ current, onNavigate, collapsed, pinnedCollapsed, onToggle, onHoverChange, mobileOpen, onCloseMobile, userName, isAdmin, onSignOut, onOpenAdmin }) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={onCloseMobile} />
      )}
      <aside
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
        className={`fixed top-0 z-40 h-screen bg-white border-r border-slate-100 flex flex-col transition-all duration-200
          ${pinnedCollapsed ? "lg:fixed" : "lg:sticky"}
          ${collapsed ? "lg:w-[76px]" : "lg:w-64"}
          ${pinnedCollapsed && !collapsed ? "lg:shadow-2xl" : ""}
          ${mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0 w-64"}`}
      >
        <div className={`flex items-center gap-3 px-5 py-4 border-b border-slate-100 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          {collapsed ? (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-display text-lg font-bold" style={{ backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
              L
            </div>
          ) : (
            <div className="leading-none">
              <p className="font-display font-bold text-[26px] tracking-tight" style={{ color: "var(--primary)" }}>
                Love
              </p>
              <p className="text-[11px] font-medium text-slate-400 tracking-wide mt-0.5">
                Canecas e personalizados
              </p>
            </div>
          )}
          <button onClick={onCloseMobile} className="ml-auto lg:hidden text-slate-400">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = current === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onNavigate(item.key);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                  ${collapsed ? "lg:justify-center" : ""}
                  ${active ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                style={active ? { backgroundColor: "var(--primary)" } : {}}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="lg:inline">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={onToggle}
            className={`hidden lg:flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 ${collapsed ? "justify-center" : ""}`}
          >
            <ChevronRight size={15} className={`transition-transform ${collapsed ? "" : "rotate-180"}`} />
            {!collapsed && "Recolher menu"}
          </button>
          {!collapsed && (
            <AccountBadge userName={userName} isAdmin={isAdmin} onSignOut={onSignOut} onOpenAdmin={onOpenAdmin} />
          )}
        </div>
      </aside>
    </>
  );
}

/* ============================================================================
   TOPBAR
============================================================================ */
function Topbar({ title, onOpenMobile, search, onSearch, onBack, onForward, canBack, canForward }) {
  const navBtn = "w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 hover:border-slate-300 disabled:opacity-35 disabled:cursor-not-allowed transition-colors";
  return (
    <header className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur border-b border-slate-100 h-16 flex items-center px-4 sm:px-6 gap-4">
      <button onClick={onOpenMobile} className="lg:hidden text-slate-500">
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-1.5">
        <button onClick={onBack} disabled={!canBack} className={navBtn} title="Voltar" aria-label="Voltar">
          <ChevronLeft size={16} />
        </button>
        <button onClick={onForward} disabled={!canForward} className={navBtn} title="Avançar" aria-label="Avançar">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="lg:hidden leading-none">
        <p className="font-display font-bold text-lg" style={{ color: "var(--primary)" }}>
          Love <span className="text-slate-400 font-sans font-normal text-xs align-middle">· {title}</span>
        </p>
      </div>
      <h1 className="hidden lg:block text-lg font-semibold text-slate-800 font-display">{title}</h1>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 w-44 sm:w-64 focus-within:border-slate-300">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
            placeholder="Buscar nesta tela…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => onSearch("")} className="text-slate-300 hover:text-slate-500 shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ============================================================================
   DASHBOARD
============================================================================ */
function MetricCard({ icon: Icon, label, value, tone, trend }) {
  const tones = {
    slate: { bg: "bg-slate-100", text: "text-slate-600" },
    green: { bg: "bg-emerald-50", text: "text-emerald-600" },
    red: { bg: "bg-rose-50", text: "text-rose-600" },
    primary: { bg: null, text: null },
  };
  const t = tones[tone];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.bg || ""}`}
          style={tone === "primary" ? { backgroundColor: "var(--primary-light)" } : {}}
        >
          <Icon size={16} className={t.text || ""} style={tone === "primary" ? { color: "var(--primary)" } : {}} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-800 mt-3 font-display">{value}</p>
      {trend !== undefined && (
        <p className={`text-xs mt-1.5 flex items-center gap-1 ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(trend).toFixed(1)}% vs. período anterior
        </p>
      )}
    </Card>
  );
}

const PERIODS = [
  { k: "dia", label: "Hoje", days: 1, buckets: 7, unit: "day" },
  { k: "semana", label: "7 dias", days: 7, buckets: 8, unit: "week" },
  { k: "quinzena", label: "15 dias", days: 15, buckets: 6, unit: "fortnight" },
  { k: "mes", label: "Mês", days: 30, buckets: 6, unit: "month" },
  { k: "trimestre", label: "Trimestre", days: 90, buckets: 8, unit: "month" },
  { k: "ano", label: "Ano", days: 365, buckets: 5, unit: "year" },
];

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const parseDate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

function Dashboard() {
  const { state } = useStore();
  const { transactions, orcamentos, pedidos } = state;
  const [period, setPeriod] = useState("mes");

  const cfg = PERIODS.find((p) => p.k === period) || PERIODS[3];
  const today = startOfDay(new Date());
  const rangeStart = addDays(today, -(cfg.days - 1));
  const prevStart = addDays(rangeStart, -cfg.days);

  const sumBetween = (from, to, type) =>
    transactions
      .filter((t) => {
        const d = parseDate(t.date);
        return d && d >= from && d <= to && t.type === type;
      })
      .reduce((acc, t) => acc + Number(t.value), 0);

  const entradas = sumBetween(rangeStart, today, "entrada");
  const saidas = sumBetween(rangeStart, today, "saida");
  const entradasAnt = sumBetween(prevStart, addDays(rangeStart, -1), "entrada");
  const saidasAnt = sumBetween(prevStart, addDays(rangeStart, -1), "saida");
  const lucro = entradas - saidas;
  const lucroAnt = entradasAnt - saidasAnt;

  const saldoAtual = transactions.reduce(
    (acc, t) => acc + (t.type === "entrada" ? Number(t.value) : -Number(t.value)),
    0
  );

  const pctTrend = (curr, prev) => (prev === 0 ? 0 : ((curr - prev) / Math.abs(prev)) * 100);

  const chartData = useMemo(() => {
    const buckets = [];
    for (let i = cfg.buckets - 1; i >= 0; i--) {
      let from;
      let to;
      let label;
      if (cfg.unit === "day") {
        from = addDays(today, -i);
        to = from;
        label = `${String(from.getDate()).padStart(2, "0")}/${String(from.getMonth() + 1).padStart(2, "0")}`;
      } else if (cfg.unit === "week" || cfg.unit === "fortnight") {
        const span = cfg.unit === "week" ? 7 : 15;
        to = addDays(today, -i * span);
        from = addDays(to, -(span - 1));
        label = `${String(from.getDate()).padStart(2, "0")}/${String(from.getMonth() + 1).padStart(2, "0")}`;
      } else if (cfg.unit === "month") {
        const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
        from = ref;
        to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
        label = monthLabel(ref.getMonth());
      } else {
        const y = today.getFullYear() - i;
        from = new Date(y, 0, 1);
        to = new Date(y, 11, 31);
        label = String(y);
      }
      buckets.push({
        mes: label,
        Entradas: sumBetween(from, to, "entrada"),
        Saídas: sumBetween(from, to, "saida"),
      });
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, period]);

  const inRange = (iso) => {
    const d = parseDate(iso);
    return d && d >= rangeStart && d <= today;
  };

  const pedidosPeriodo = pedidos.filter((p) => inRange(p.createdAt));
  const finalizadosPeriodo = pedidosPeriodo.filter((p) => p.status === "finalizado");
  const orcamentosPendentes = orcamentos.filter((o) => o.status === "pendente");
  const emProducao = pedidos.filter((p) => p.status === "em_producao");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Calendar size={15} className="text-slate-400" />
        <span className="text-xs text-slate-500 mr-1">Período:</span>
        {PERIODS.map((p) => (
          <button
            key={p.k}
            onClick={() => setPeriod(p.k)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              period === p.k ? "text-white border-transparent" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
            style={period === p.k ? { backgroundColor: "var(--primary)" } : {}}
          >
            {p.label}
          </button>
        ))}
        <span className="text-[11px] text-slate-400 ml-auto">
          {fmtDate(rangeStart.toISOString().slice(0, 10))} — {fmtDate(today.toISOString().slice(0, 10))}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard icon={DollarSign} label="Saldo Atual (total)" value={fmtBRL(saldoAtual)} tone="primary" />
        <MetricCard icon={TrendingUp} label="Entradas no período" value={fmtBRL(entradas)} tone="green" trend={pctTrend(entradas, entradasAnt)} />
        <MetricCard icon={TrendingDown} label="Saídas no período" value={fmtBRL(saidas)} tone="red" trend={pctTrend(saidas, saidasAnt)} />
        <MetricCard
          icon={lucro >= 0 ? TrendingUp : TrendingDown}
          label="Lucro / Prejuízo"
          value={fmtBRL(lucro)}
          tone={lucro >= 0 ? "green" : "red"}
          trend={pctTrend(lucro, lucroAnt)}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle title="Evolução do caixa" subtitle="Entradas vs. Saídas no período selecionado" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
                />
                <Tooltip
                  formatter={(v) => fmtBRL(v)}
                  contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Saídas" fill={BRAND.primary} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Acompanhe agora" subtitle="Orçamentos e pedidos aguardando você" />
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {orcamentosPendentes.map((o) => (
              <div key={o.id} className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/60">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-100">
                  <FileText size={14} className="text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 truncate">Orçamento #{o.numero} aguardando resposta</p>
                  <p className="text-[11px] text-slate-400 truncate">{o.clientName} · {fmtDate(o.createdAt)}</p>
                </div>
                <span className="text-xs font-semibold shrink-0 text-amber-700">{fmtBRL(o.total)}</span>
              </div>
            ))}
            {emProducao.map((p) => (
              <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-200/70">
                  <ClipboardList size={14} className="text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 truncate">Pedido #{p.numero} em produção</p>
                  <p className="text-[11px] text-slate-400 truncate">{p.clientName} · {fmtDate(p.createdAt)}</p>
                </div>
                <span className="text-xs font-semibold shrink-0 text-slate-600">{fmtBRL(p.total)}</span>
              </div>
            ))}
            {orcamentosPendentes.length === 0 && emProducao.length === 0 && (
              <EmptyState icon={CheckCircle2} title="Tudo em dia" subtitle="Nenhum orçamento ou pedido em aberto." />
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs text-slate-400">Orçamentos criados no período</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1 font-display">
            {orcamentos.filter((o) => inRange(o.createdAt)).length}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-400">Pedidos no período</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1 font-display">{pedidosPeriodo.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-400">Faturado com pedidos finalizados</p>
          <p className="text-2xl font-semibold mt-1 font-display text-emerald-600">
            {fmtBRL(finalizadosPeriodo.reduce((a, p) => a + Number(p.total || 0), 0))}
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   CADASTROS (Clientes & Fornecedores)
============================================================================ */
function PeopleTable({ title, icon: Icon, people, onAdd, onDelete, addLabel }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name) return;
    onAdd({ ...form, id: uid() });
    setForm({ name: "", phone: "", email: "" });
    setShowForm(false);
  };

  return (
    <Card className="p-5">
      <SectionTitle
        title={title}
        subtitle={`${people.length} cadastrado(s)`}
        action={
          <Button variant={showForm ? "outline" : "primary"} onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? "Cancelar" : addLabel}
          </Button>
        }
      />

      {showForm && (
        <form onSubmit={submit} className="grid sm:grid-cols-3 gap-3 mb-5 p-4 bg-slate-50 rounded-xl">
          <Input placeholder="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <div className="flex gap-2">
            <Input placeholder="E-mail" className="flex-1" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <Button type="submit" className="shrink-0 px-3.5">
              <Plus size={15} />
            </Button>
          </div>
        </form>
      )}

      {people.length === 0 ? (
        <EmptyState icon={Icon} title="Nenhum registro" subtitle="Adicione o primeiro cadastro." />
      ) : (
        <div className="space-y-1">
          {people.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500 shrink-0">
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                <p className="text-xs text-slate-400 truncate">{[p.phone, p.email].filter(Boolean).join(" · ") || "Sem contato"}</p>
              </div>
              <button onClick={() => onDelete(p.id)} className="text-slate-300 hover:text-rose-500 shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Cadastros() {
  const { state, dispatch, search } = useStore();
  const [tab, setTab] = useState("clientes");
  const flt = (arr) => arr.filter((p) => matchSearch(search, p.name, p.phone, p.email));

  return (
    <div className="space-y-5">
      <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-100 w-fit">
        {[
          { k: "clientes", l: "Clientes", icon: Users },
          { k: "fornecedores", l: "Fornecedores", icon: Truck },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.k ? "text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
            style={tab === t.k ? { backgroundColor: "var(--primary)" } : {}}
          >
            <t.icon size={15} /> {t.l}
          </button>
        ))}
      </div>

      {tab === "clientes" ? (
        <PeopleTable
          title="Clientes"
          icon={Users}
          people={flt(state.clients)}
          addLabel="Novo cliente"
          onAdd={(p) => dispatch({ type: "ADD_CLIENT", payload: p })}
          onDelete={(id) => dispatch({ type: "DELETE_CLIENT", payload: id })}
        />
      ) : (
        <PeopleTable
          title="Fornecedores"
          icon={Truck}
          people={flt(state.suppliers)}
          addLabel="Novo fornecedor"
          onAdd={(p) => dispatch({ type: "ADD_SUPPLIER", payload: p })}
          onDelete={(id) => dispatch({ type: "DELETE_SUPPLIER", payload: id })}
        />
      )}
    </div>
  );
}

/* ============================================================================
   PRECIFICAÇÃO (Engine de Custos)
============================================================================ */
function computeProductCost(product) {
  const lines = (product.bom || []).map((b) => {
    const cost = Number(b.manualValue || 0);
    const pct = Number(b.profitPct || 0);
    const finalValue = cost * (1 + pct / 100);
    const profit = finalValue - cost;
    return { ...b, label: b.manualName || "Item de custo", cost, finalValue, profit };
  });
  const totalCost = lines.reduce((acc, l) => acc + l.cost, 0);
  const finalPrice = lines.reduce((acc, l) => acc + l.finalValue, 0);
  const profit = finalPrice - totalCost;
  const avgPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  return { lines, totalCost, finalPrice, profit, avgPct };
}

function NewProductForm({ onClose }) {
  const { dispatch } = useStore();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("produto");
  const [defaultPct, setDefaultPct] = useState(100);
  const [bom, setBom] = useState(() => [
    { id: uid(), manualName: "", manualValue: "", profitPct: 100 },
  ]);

  const addLine = () =>
    setBom((b) => [...b, { id: uid(), manualName: "", manualValue: "", profitPct: defaultPct }]);
  const removeLine = (id) => setBom((b) => b.filter((l) => l.id !== id));
  const updateLine = (id, field, value) => setBom((b) => b.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

  const applyPctToAll = () => setBom((b) => b.map((l) => ({ ...l, profitPct: defaultPct })));

  const preview = useMemo(() => computeProductCost({ bom }), [bom]);

  const submit = (e) => {
    e.preventDefault();
    if (!name || bom.length === 0) return;
    dispatch({
      type: "ADD_PRODUCT",
      payload: {
        id: uid(),
        name,
        kind,
        bom: bom.map((l) => ({
          id: uid(),
          manualName: l.manualName,
          manualValue: Number(l.manualValue) || 0,
          profitPct: Number(l.profitPct) || 0,
        })),
      },
    });
    onClose();
  };

  return (
    <Card className="p-5 mb-6">
      <SectionTitle
        title="Criar Novo Produto ou Serviço"
        subtitle="Monte a composição de custos e defina a margem que você quer ganhar em cada item"
        action={
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        }
      />
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Nome do produto ou serviço" placeholder="Ex: Caixinha Surpresa Festa" value={name} onChange={(e) => setName(e.target.value)} required />
          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1.5">Tipo</span>
            <div className="flex gap-2">
              {[
                { k: "produto", l: "Produto" },
                { k: "servico", l: "Serviço" },
              ].map((k) => (
                <button
                  key={k.k}
                  type="button"
                  onClick={() => setKind(k.k)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium border transition-colors ${
                    kind === k.k ? "text-white border-transparent" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                  style={kind === k.k ? { backgroundColor: "var(--primary)" } : {}}
                >
                  {k.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">Composição de custos</span>
            <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--primary)" }}>
              <PlusCircle size={14} /> Adicionar item de custo
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Liste tudo o que entra no item — material, mão de obra, embalagem, frete — com o valor que você pagou.
          </p>

          <div className="space-y-2">
            {bom.map((line) => {
              const cost = Number(line.manualValue || 0);
              const pct = Number(line.profitPct || 0);
              const finalValue = cost * (1 + pct / 100);
              return (
                <div key={line.id} className="rounded-xl p-3 bg-slate-50 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input
                      type="text"
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                      placeholder="Nome do item (ex: caneca, tinta, mão de obra, frete)"
                      value={line.manualName}
                      onChange={(e) => updateLine(line.id, "manualName", e.target.value)}
                    />
                    <div className="relative w-full sm:w-32 shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm text-slate-700 outline-none"
                        value={line.manualValue}
                        onChange={(e) => updateLine(line.id, "manualValue", e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    <button type="button" onClick={() => removeLine(line.id)} className="text-slate-300 hover:text-rose-500 shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pl-0.5">
                    <span className="text-[11px] text-slate-400">Custo: <strong className="text-slate-600">{fmtBRL(cost)}</strong></span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Ganho desejado neste item:</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none text-right"
                        value={line.profitPct}
                        onChange={(e) => updateLine(line.id, "profitPct", e.target.value)}
                      />
                      <span className="text-[11px] text-slate-400">%</span>
                    </div>
                    <span className="text-[11px] font-medium ml-auto" style={{ color: "var(--primary-dark)" }}>
                      Fica em: {fmtBRL(finalValue)}
                    </span>
                  </div>
                </div>
              );
            })}
            {bom.length === 0 && <p className="text-xs text-slate-400 py-3">Adicione ao menos um item de custo.</p>}
          </div>
        </div>


        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-slate-200 p-3.5">
          <Input
            label="Aplicar % de ganho em todos os itens de uma vez"
            type="number"
            min="0"
            step="1"
            className="w-40"
            value={defaultPct}
            onChange={(e) => setDefaultPct(e.target.value)}
          />
          <Button type="button" variant="outline" onClick={applyPctToAll}>
            Aplicar a todos
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 items-end">
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-400">Custo total</p>
            <p className="text-xl font-semibold text-slate-700 mt-0.5">{fmtBRL(preview.totalCost)}</p>
            <p className="text-xs text-emerald-600 mt-1">+ {fmtBRL(preview.profit)} de ganho ({preview.avgPct.toFixed(0)}% em média)</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--primary-light)" }}>
            <p className="text-xs" style={{ color: "var(--primary-dark)" }}>Preço final sugerido</p>
            <p className="text-2xl font-semibold font-display" style={{ color: "var(--primary-dark)" }}>
              {fmtBRL(preview.finalPrice)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--primary-dark)" }}>
              Use isso como teto — o quanto abaixo disso você pode dar de desconto sem perder o seu ganho.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Salvar {kind === "servico" ? "serviço" : "produto"}</Button>
        </div>
      </form>
    </Card>
  );
}

function ProductDetailRow({ line }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-xs border-b border-slate-50 last:border-0">
      <span className="text-slate-500 truncate">{line.label}</span>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-slate-400">custo {fmtBRL(line.cost)}</span>
        <Badge tone="slate">+{Number(line.profitPct).toFixed(0)}%</Badge>
        <span className="font-medium" style={{ color: "var(--primary-dark)" }}>{fmtBRL(line.finalValue)}</span>
      </div>
    </div>
  );
}

function Precificacao() {
  const { state, dispatch, search } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [kindFilter, setKindFilter] = useState("todos");
  const [expanded, setExpanded] = useState(null);

  const products = state.products
    .filter((p) => kindFilter === "todos" || p.kind === kindFilter)
    .filter((p) => matchSearch(search, p.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} /> Criar Novo Produto ou Serviço
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          {[
            { k: "todos", l: "Todos" },
            { k: "produto", l: "Produtos" },
            { k: "servico", l: "Serviços" },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setKindFilter(f.k)}
              className={`text-xs font-medium px-3 py-2 rounded-lg border ${
                kindFilter === f.k ? "text-white border-transparent" : "border-slate-200 text-slate-500 hover:bg-white"
              }`}
              style={kindFilter === f.k ? { backgroundColor: "var(--primary)" } : {}}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {showForm && <NewProductForm onClose={() => setShowForm(false)} />}

      {products.length === 0 ? (
        <Card>
          <EmptyState icon={Calculator} title="Nenhum item precificado" subtitle="Crie seu primeiro produto ou serviço para calcular o custo automaticamente." />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {products.map((p) => {
            const { lines, totalCost, finalPrice, profit, avgPct } = computeProductCost(p);
            const isOpen = expanded === p.id;
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <Badge tone={p.kind === "servico" ? "amber" : "green"}>{p.kind === "servico" ? "Serviço" : "Produto"}</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{lines.length} item(ns) · ganho médio {avgPct.toFixed(0)}%</p>
                  </div>
                  <button onClick={() => dispatch({ type: "DELETE_PRODUCT", payload: p.id })} className="text-slate-300 hover:text-rose-500 shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-[10px] text-slate-400">Custo</p>
                    <p className="text-sm font-semibold text-slate-700">{fmtBRL(totalCost)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-[10px] text-slate-400">Ganho</p>
                    <p className="text-sm font-semibold text-emerald-600">{fmtBRL(profit)}</p>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: "var(--primary-light)" }}>
                    <p className="text-[10px]" style={{ color: "var(--primary-dark)" }}>Venda</p>
                    <p className="text-sm font-semibold" style={{ color: "var(--primary-dark)" }}>
                      {fmtBRL(finalPrice)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                  className="text-xs font-medium mt-3.5 flex items-center gap-1"
                  style={{ color: "var(--primary)" }}
                >
                  <ChevronRight size={13} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  {isOpen ? "Ocultar" : "Ver"} ganho por item (útil pra pensar em desconto)
                </button>

                {isOpen && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    {lines.map((l) => (
                      <ProductDetailRow key={l.id} line={l} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   ORÇAMENTOS & PEDIDOS
   Orçamento nasce com número automático a partir de 1000. Ao ser aprovado,
   vira pedido com o prefixo "11" (ex.: orçamento 1000 → pedido 111000).
   Só pedidos "finalizados" lançam entrada no faturamento — adiado ou
   cancelado não entra no faturamento.
============================================================================ */
const ORCAMENTO_STATUS = {
  pendente: { label: "Pendente", tone: "amber" },
  aprovado: { label: "Aprovado", tone: "green" },
  reprovado: { label: "Reprovado", tone: "red" },
};

const PEDIDO_STATUS = {
  em_producao: { label: "Em produção", tone: "slate" },
  finalizado: { label: "Finalizado", tone: "green" },
  adiado: { label: "Adiado", tone: "amber" },
  cancelado: { label: "Cancelado", tone: "red" },
};

const escHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function exportOrcamentoPDF(o) {
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    alert("Seu navegador bloqueou a janela de impressão. Permita pop-ups para gerar o PDF.");
    return;
  }
  const itemsHtml = o.items
    .map(
      (i) => `
      <tr>
        <td>${escHtml(i.name)}</td>
        <td style="text-align:center">${i.qty}</td>
        <td style="text-align:right">${fmtBRL(i.unitPrice)}</td>
        <td style="text-align:right">${fmtBRL(i.lineTotal)}</td>
      </tr>`
    )
    .join("");

  const clientLines = [
    `<strong>${escHtml(o.clientName)}</strong>`,
    o.clientPhone ? escHtml(o.clientPhone) : null,
    o.clientEmail ? escHtml(o.clientEmail) : null,
  ]
    .filter(Boolean)
    .join("<br/>");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Orçamento Nº ${o.numero} · Love, Canecas e personalizados</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Georgia, 'Times New Roman', serif; padding: 36px; color: #1e293b; }
          h1 { font-size: 22px; margin: 0; color: ${BRAND.primaryDark}; }
          h1 span { color: ${BRAND.primary}; }
          .sub { color: #64748b; font-size: 12px; margin: 4px 0 0; font-family: sans-serif; }
          .doc { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin: 26px 0 18px; }
          .doc .num { font-size: 18px; font-weight: bold; color: ${BRAND.primaryDark}; }
          .doc .dates { font-family: sans-serif; font-size: 11px; color: #64748b; text-align: right; line-height: 1.7; }
          .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; display: block; margin-bottom: 4px; font-family: sans-serif; }
          .client { background: #f8fafc; border-radius: 10px; padding: 12px 16px; font-family: sans-serif; font-size: 12px; color: #334155; line-height: 1.7; margin-bottom: 18px; }
          .msg { font-size: 13px; line-height: 1.8; color: #334155; margin-bottom: 22px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: sans-serif; }
          th { text-align: left; background: #f8fafc; padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
          td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; }
          .total { display: flex; justify-content: space-between; align-items: center; background: ${BRAND.primaryLight}; border-radius: 10px; padding: 14px 18px; margin-top: 18px; }
          .total .lbl { color: ${BRAND.primaryDark}; margin: 0; }
          .total .val { font-size: 20px; font-weight: bold; color: ${BRAND.primaryDark}; }
          .foot { margin-top: 26px; font-family: sans-serif; font-size: 11px; color: #64748b; line-height: 1.8; border-top: 1px solid #f1f5f9; padding-top: 14px; }
          @media print { body { padding: 12px; } }
        </style>
      </head>
      <body>
        <h1><span>Love</span>, Canecas e personalizados</h1>
        <p class="sub">Orçamento artesanal feito com carinho</p>
        <div class="doc">
          <div>
            <span class="lbl">Orçamento</span>
            <span class="num">Nº ${o.numero}</span>
          </div>
          <div class="dates">
            Emitido em ${fmtDate(o.createdAt)}<br/>
            PDF extraído em ${fmtDate(todayISO())}
          </div>
        </div>
        <div class="client">
          <span class="lbl">Cliente</span>
          ${clientLines}
        </div>
        <p class="msg">
          Olá, ${escHtml(o.clientName)}! Ficamos muito felizes com o seu interesse em nossos produtos artesanais.
          Preparamos este orçamento com muito carinho, pensando em cada detalhe para deixar tudo do seu jeitinho.
          Segue abaixo a relação de itens e valores:
        </p>
        <table>
          <thead>
            <tr><th>Item</th><th style="text-align:center">Qtd.</th><th style="text-align:right">Valor unit.</th><th style="text-align:right">Subtotal</th></tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="total">
          <span class="lbl">Total do orçamento</span>
          <span class="val">${fmtBRL(o.total)}</span>
        </div>
        <div class="foot">
          Este orçamento é válido por 15 dias a partir da data de emissão.<br/>
          Qualquer dúvida ou ajuste, estamos à disposição — será um prazer atender você!<br/>
          Obrigada pela preferência. — Love, Canecas e personalizados
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 350);
}

function OrcamentoForm({ onClose }) {
  const { state, dispatch } = useStore();
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState([]);
  const [selProduct, setSelProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");

  const total = items.reduce((a, i) => a + i.lineTotal, 0);
  const nextNumero = state.orcamentos.reduce((max, o) => Math.max(max, Number(o.numero) || 0), 999) + 1;
  const noClients = state.clients.length === 0;
  const noProducts = state.products.length === 0;

  const onPickProduct = (e) => {
    const id = e.target.value;
    setSelProduct(id);
    const p = state.products.find((x) => x.id === id);
    if (p) setUnitPrice(computeProductCost(p).finalPrice.toFixed(2));
  };

  const addItem = () => {
    const p = state.products.find((x) => x.id === selProduct);
    const q = Number(qty) || 0;
    const up = Number(unitPrice);
    if (!p || q <= 0 || unitPrice === "" || up < 0) return;
    setItems((arr) => [
      ...arr,
      { id: uid(), productId: p.id, name: p.name, kind: p.kind, qty: q, unitPrice: up, lineTotal: q * up },
    ]);
    setSelProduct("");
    setQty(1);
    setUnitPrice("");
  };

  const submit = (e) => {
    e.preventDefault();
    const client = state.clients.find((c) => c.id === clientId);
    if (!client || items.length === 0) return;
    dispatch({
      type: "ADD_ORCAMENTO",
      payload: {
        id: uid(),
        numero: nextNumero,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone || "",
        clientEmail: client.email || "",
        items,
        total,
        status: "pendente",
        createdAt: todayISO(),
      },
    });
    onClose();
  };

  return (
    <Card className="p-5 mb-6">
      <SectionTitle
        title={`Novo Orçamento · Nº ${nextNumero}`}
        subtitle="Escolha o cliente e monte a lista com os produtos e serviços já precificados"
        action={
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        }
      />

      {(noClients || noProducts) && (
        <div className="flex gap-3 rounded-xl p-3.5 mb-4" style={{ backgroundColor: "var(--accent-light)" }}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
          <p className="text-xs text-slate-600 leading-relaxed">
            {noClients && "Antes de orçar, cadastre o cliente na aba Cadastros. "}
            {noProducts && "Cadastre seus produtos/serviços na aba Precificação para puxar os preços automaticamente."}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <Select label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
          <option value="">Selecione o cliente…</option>
          {state.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <div>
          <span className="block text-xs font-medium text-slate-500 mb-1.5">Itens do orçamento</span>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              value={selProduct}
              onChange={onPickProduct}
            >
              <option value="">Escolha um produto ou serviço…</option>
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.kind === "servico" ? "Serviço" : "Produto"})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="1"
              className="w-full sm:w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qtd."
            />
            <div className="relative w-full sm:w-32 shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm text-slate-700 outline-none"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <Button type="button" onClick={addItem} disabled={!selProduct} className="shrink-0">
              <Plus size={15} /> Adicionar
            </Button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            O valor unitário vem do preço final da Precificação — você pode ajustá-lo aqui para dar desconto sem perder o seu ganho.
          </p>

          {items.length > 0 && (
            <div className="space-y-1.5 mt-3">
              {items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{i.name}</p>
                    <p className="text-xs text-slate-400">
                      {i.qty} × {fmtBRL(i.unitPrice)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 shrink-0">{fmtBRL(i.lineTotal)}</span>
                  <button
                    type="button"
                    onClick={() => setItems((arr) => arr.filter((x) => x.id !== i.id))}
                    className="text-slate-300 hover:text-rose-500 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {items.length === 0 && (
            <p className="text-xs text-slate-400 py-3">Adicione ao menos um produto ou serviço para salvar o orçamento.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4" style={{ backgroundColor: "var(--primary-light)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--primary-dark)" }}>
            Total do orçamento
          </p>
          <p className="text-2xl font-semibold font-display" style={{ color: "var(--primary-dark)" }}>
            {fmtBRL(total)}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!clientId || items.length === 0}>
            Salvar orçamento
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Orcamentos() {
  const { state, dispatch, search } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("todos");

  const rows = state.orcamentos
    .filter((o) => filter === "todos" || o.status === filter)
    .filter((o) => matchSearch(search, o.numero, o.clientName))
    .sort((a, b) => b.numero - a.numero);


  const setStatus = (o, status) => {
    dispatch({ type: "SET_ORCAMENTO_STATUS", payload: { id: o.id, status } });
    if (status === "aprovado" && !state.pedidos.some((p) => p.orcamentoId === o.id)) {
      dispatch({
        type: "ADD_PEDIDO",
        payload: {
          id: uid(),
          numero: `11${o.numero}`,
          orcamentoId: o.id,
          orcamentoNumero: o.numero,
          clientName: o.clientName,
          items: o.items,
          total: o.total,
          status: "em_producao",
          createdAt: todayISO(),
          finalizedAt: null,
          transactionId: null,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {!showForm && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} /> Novo Orçamento
          </Button>
          <div className="flex gap-2 ml-auto">
            {[
              { k: "todos", l: "Todos" },
              { k: "pendente", l: "Pendentes" },
              { k: "aprovado", l: "Aprovados" },
              { k: "reprovado", l: "Reprovados" },
            ].map((f) => (
              <button
                key={f.k}
                onClick={() => setFilter(f.k)}
                className={`text-xs font-medium px-3 py-2 rounded-lg border ${
                  filter === f.k ? "text-white border-transparent" : "border-slate-200 text-slate-500 hover:bg-white"
                }`}
                style={filter === f.k ? { backgroundColor: "var(--primary)" } : {}}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && <OrcamentoForm onClose={() => setShowForm(false)} />}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum orçamento por aqui"
            subtitle="Crie seu primeiro orçamento: escolha o cliente, monte a lista de itens e extraia o PDF para enviar."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Nº</th>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Itens</th>
                  <th className="px-5 py-3 font-medium text-right">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-semibold text-slate-700 whitespace-nowrap">#{o.numero}</td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">{o.clientName}</td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{o.items.length} item(ns)</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-700 whitespace-nowrap">{fmtBRL(o.total)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={ORCAMENTO_STATUS[o.status].tone}>{ORCAMENTO_STATUS[o.status].label}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Extrair PDF do orçamento"
                          onClick={() => exportOrcamentoPDF(o)}
                          className="p-1.5 text-slate-400 hover:text-slate-700"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          title="Marcar como aprovado (vira pedido)"
                          onClick={() => setStatus(o, "aprovado")}
                          className={`p-1.5 ${o.status === "aprovado" ? "text-emerald-600" : "text-slate-300 hover:text-emerald-600"}`}
                        >
                          <CheckCircle2 size={15} />
                        </button>
                        <button
                          title="Marcar como reprovado"
                          onClick={() => setStatus(o, "reprovado")}
                          className={`p-1.5 ${o.status === "reprovado" ? "text-rose-500" : "text-slate-300 hover:text-rose-500"}`}
                        >
                          <Ban size={15} />
                        </button>
                        {o.status !== "pendente" && (
                          <button
                            title="Voltar para pendente"
                            onClick={() => setStatus(o, "pendente")}
                            className="p-1.5 text-slate-300 hover:text-slate-600"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        <button
                          title="Excluir orçamento"
                          onClick={() => dispatch({ type: "DELETE_ORCAMENTO", payload: o.id })}
                          className="p-1.5 text-slate-300 hover:text-rose-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Pedidos() {
  const { state, dispatch, search } = useStore();
  const [filter, setFilter] = useState("todos");
  const [finalizing, setFinalizing] = useState(null);
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0]);

  const rows = state.pedidos
    .filter((p) => filter === "todos" || p.status === filter)
    .filter((p) => matchSearch(search, p.numero, p.orcamentoNumero, p.clientName))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.numero.localeCompare(a.numero));


  const sumStatus = (s) => state.pedidos.filter((p) => p.status === s).reduce((a, p) => a + p.total, 0);
  const countStatus = (s) => state.pedidos.filter((p) => p.status === s).length;

  const changeStatus = (p, status, paymentMethod) => {
    if (status === p.status) return;
    // Saindo de "finalizado": estorna a entrada do financeiro
    if (p.status === "finalizado" && p.transactionId) {
      dispatch({ type: "DELETE_TRANSACTION", payload: p.transactionId });
    }
    let transactionId = null;
    if (status === "finalizado") {
      transactionId = uid();
      dispatch({
        type: "ADD_TRANSACTION",
        payload: {
          id: transactionId,
          date: todayISO(),
          description: `Pedido #${p.numero} — ${p.clientName}`,
          value: p.total,
          type: "entrada",
          category: "Venda de Produto",
          paymentMethod: paymentMethod || PAYMENT_METHODS[0],
          client: p.clientName,
          hasReceipt: false,
        },
      });
    }
    dispatch({
      type: "SET_PEDIDO_STATUS",
      payload: { id: p.id, patch: { status, finalizedAt: status === "finalizado" ? todayISO() : null, transactionId } },
    });
    setFinalizing(null);
  };

  const remove = (p) => {
    if (p.transactionId) dispatch({ type: "DELETE_TRANSACTION", payload: p.transactionId });
    dispatch({ type: "DELETE_PEDIDO", payload: p.id });
  };

  const summary = [
    { k: "em_producao", label: "Em produção" },
    { k: "finalizado", label: "Finalizados" },
    { k: "adiado", label: "Adiados" },
    { k: "cancelado", label: "Cancelados" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {summary.map((s) => (
          <Card key={s.k} className="p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="text-lg font-semibold text-slate-800 mt-1">{countStatus(s.k)} pedido(s)</p>
            <p className="text-xs text-slate-500 mt-0.5">{fmtBRL(sumStatus(s.k))}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-600" />
          Só pedidos finalizados entram como entrada no faturamento.
        </p>
        <div className="flex gap-2 ml-auto">
          {[
            { k: "todos", l: "Todos" },
            { k: "em_producao", l: "Em produção" },
            { k: "finalizado", l: "Finalizados" },
            { k: "adiado", l: "Adiados" },
            { k: "cancelado", l: "Cancelados" },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`text-xs font-medium px-3 py-2 rounded-lg border ${
                filter === f.k ? "text-white border-transparent" : "border-slate-200 text-slate-500 hover:bg-white"
              }`}
              style={filter === f.k ? { backgroundColor: "var(--primary)" } : {}}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhum pedido por aqui"
            subtitle="Quando um orçamento for aprovado pelo cliente, ele aparece aqui automaticamente como pedido em produção."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Pedido</th>
                  <th className="px-5 py-3 font-medium">Orçamento</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium text-right">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-semibold text-slate-700 whitespace-nowrap">#{p.numero}</td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">#{p.orcamentoNumero}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">{p.clientName}</td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-700 whitespace-nowrap">{fmtBRL(p.total)}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={PEDIDO_STATUS[p.status].tone}>{PEDIDO_STATUS[p.status].label}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {p.status !== "finalizado" && (
                            <button
                              onClick={() => {
                                setFinalizing(p.id);
                                setPayMethod(PAYMENT_METHODS[0]);
                              }}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            >
                              Finalizar
                            </button>
                          )}
                          {p.status !== "adiado" && p.status !== "finalizado" && (
                            <button
                              onClick={() => changeStatus(p, "adiado")}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                            >
                              Adiar
                            </button>
                          )}
                          {p.status !== "cancelado" && p.status !== "finalizado" && (
                            <button
                              onClick={() => changeStatus(p, "cancelado")}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"
                            >
                              Cancelar
                            </button>
                          )}
                          {p.status !== "em_producao" && (
                            <button
                              onClick={() => changeStatus(p, "em_producao")}
                              title="Voltar para em produção"
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                            >
                              Reabrir
                            </button>
                          )}
                          <button onClick={() => remove(p)} className="p-1.5 text-slate-300 hover:text-rose-500" title="Excluir pedido">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {finalizing === p.id && (
                      <tr className="border-b border-slate-50 bg-emerald-50/40">
                        <td colSpan={7} className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-xs text-emerald-800 font-medium">
                              Ao finalizar, {fmtBRL(p.total)} entra como entrada no faturamento. Como o cliente pagou?
                            </p>
                            <div className="flex items-center gap-2 ml-auto">
                              <select
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none"
                                value={payMethod}
                                onChange={(e) => setPayMethod(e.target.value)}
                              >
                                {PAYMENT_METHODS.map((m) => (
                                  <option key={m}>{m}</option>
                                ))}
                              </select>
                              <Button onClick={() => changeStatus(p, "finalizado", payMethod)} className="!py-1.5 !px-3 text-xs">
                                Confirmar finalização
                              </Button>
                              <button onClick={() => setFinalizing(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5">
                                Voltar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================================
   RELATÓRIOS
============================================================================ */
function Relatorios() {
  const { state, search } = useStore();
  const [type, setType] = useState("todos");

  const rows = state.transactions
    .filter((t) => type === "todos" || t.type === type)
    .filter((t) => matchSearch(search, t.description, t.category, t.client, t.paymentMethod))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalEntradas = rows.filter((t) => t.type === "entrada").reduce((a, t) => a + t.value, 0);
  const totalSaidas = rows.filter((t) => t.type === "saida").reduce((a, t) => a + t.value, 0);

  const exportExcel = () => {
    if (rows.length === 0) {
      alert("Não há transações para exportar neste filtro.");
      return;
    }
    const data = rows.map((t) => ({
      Data: fmtDate(t.date),
      Descrição: t.description,
      Categoria: t.category,
      Pagamento: t.paymentMethod,
      Cliente: t.client,
      Tipo: t.type === "entrada" ? "Entrada" : "Saída",
      Valor: t.value,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 34 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fluxo de Caixa");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fluxo-de-caixa-${todayISO()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (rows.length === 0) {
      alert("Não há transações para exportar neste filtro.");
      return;
    }
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      alert("Seu navegador bloqueou a janela de impressão. Permita pop-ups para gerar o PDF.");
      return;
    }
    const rowsHtml = rows
      .map(
        (t) => `
        <tr>
          <td>${fmtDate(t.date)}</td>
          <td>${t.description}</td>
          <td>${t.category}</td>
          <td style="text-align:right;color:${t.type === "entrada" ? "#059669" : "#e11d48"}">
            ${t.type === "entrada" ? "+" : "-"} ${fmtBRL(t.value)}
          </td>
        </tr>`
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Fluxo de Caixa · Love, Canecas e personalizados</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Georgia, 'Times New Roman', serif; padding: 36px; color: #1e293b; }
            h1 { font-size: 22px; margin: 0; color: ${BRAND.primaryDark}; }
            h1 span { color: ${BRAND.primary}; }
            p.sub { color: #64748b; font-size: 12px; margin: 4px 0 22px; }
            .totals { display: flex; gap: 14px; margin-bottom: 22px; }
            .totals div { background: #f8fafc; padding: 10px 16px; border-radius: 10px; font-size: 12px; font-family: sans-serif; }
            .totals strong { display: block; font-size: 14px; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: sans-serif; }
            th { text-align: left; background: #f8fafc; padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
            td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; }
            @media print { body { padding: 12px; } }
          </style>
        </head>
        <body>
          <h1><span>Love</span>, Canecas e personalizados</h1>
          <p class="sub">Relatório de Fluxo de Caixa &middot; gerado em ${fmtDate(todayISO())}</p>
          <div class="totals">
            <div>Entradas<strong style="color:#059669">${fmtBRL(totalEntradas)}</strong></div>
            <div>Saídas<strong style="color:#e11d48">${fmtBRL(totalSaidas)}</strong></div>
            <div>Saldo do período<strong>${fmtBRL(totalEntradas - totalSaidas)}</strong></div>
          </div>
          <table>
            <thead>
              <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th style="text-align:right">Valor</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle
          title="Fluxo de Caixa"
          subtitle="Visualize e exporte suas transações"
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportPDF}>
                <Printer size={15} /> PDF
              </Button>
              <Button onClick={exportExcel}>
                <FileDown size={15} /> Excel
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-slate-400" />
          {[
            { k: "todos", l: "Todos" },
            { k: "entrada", l: "Entradas" },
            { k: "saida", l: "Saídas" },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setType(f.k)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                type === f.k ? "text-white border-transparent" : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
              style={type === f.k ? { backgroundColor: "var(--primary)" } : {}}
            >
              {f.l}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700">Total de Entradas</p>
            <p className="text-lg font-semibold text-emerald-700 mt-0.5">{fmtBRL(totalEntradas)}</p>
          </div>
          <div className="rounded-xl bg-rose-50 p-4">
            <p className="text-xs text-rose-700">Total de Saídas</p>
            <p className="text-lg font-semibold text-rose-700 mt-0.5">{fmtBRL(totalSaidas)}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--primary-light)" }}>
            <p className="text-xs" style={{ color: "var(--primary-dark)" }}>Saldo do período</p>
            <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--primary-dark)" }}>
              {fmtBRL(totalEntradas - totalSaidas)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 bg-slate-50">
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Descrição</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-slate-50">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="px-4 py-2.5 text-slate-700">{t.description}</td>
                  <td className="px-4 py-2.5 text-slate-500">{t.category}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${t.type === "entrada" ? "text-emerald-600" : "text-rose-600"}`}>
                    {t.type === "entrada" ? "+" : "-"} {fmtBRL(t.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
   APP PRINCIPAL
============================================================================ */
const TITLES = {
  dashboard: "Painel de Controle",
  cadastros: "Cadastros",
  precificacao: "Precificação de Produtos",
  orcamentos: "Orçamentos",
  pedidos: "Pedidos",
  relatorios: "Relatórios",
};

export default function App({
  userId,
  userName = "",
  isAdmin = false,
  onSignOut,
  onOpenAdmin,
}) {
  const [nav, setNav] = useState({ stack: ["dashboard"], index: 0 });
  const page = nav.stack[nav.index];
  const canBack = nav.index > 0;
  const canForward = nav.index < nav.stack.length - 1;

  const setPage = useCallback((next) => {
    setNav((n) => {
      if (n.stack[n.index] === next) return n;
      const stack = [...n.stack.slice(0, n.index + 1), next];
      return { stack, index: stack.length - 1 };
    });
  }, []);

  const goBack = useCallback(
    () => setNav((n) => (n.index > 0 ? { ...n, index: n.index - 1 } : n)),
    []
  );
  const goForward = useCallback(
    () => setNav((n) => (n.index < n.stack.length - 1 ? { ...n, index: n.index + 1 } : n)),
    []
  );

  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [state, rawDispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    hydrateState(userId)
      .then((data) => {
        if (!alive) return;
        rawDispatch({ type: "HYDRATE", payload: data });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Falha ao carregar os dados", err);
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const dispatch = useCallback(
    (action) => {
      rawDispatch(action);
      persistAction(action, userId).catch((err) =>
        console.error("Falha ao salvar no banco de dados", err)
      );
    },
    [userId]
  );

  const store = useMemo(
    () => ({ state, dispatch, search, userName }),
    [state, dispatch, search, userName]
  );

  const renderPage = () => {
    switch (page) {
      case "cadastros":
        return <Cadastros />;
      case "precificacao":
        return <Precificacao />;
      case "orcamentos":
        return <Orcamentos />;
      case "pedidos":
        return <Pedidos />;
      case "relatorios":
        return <Relatorios />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <StoreContext.Provider value={store}>
      <BrandStyles />
      <div className="min-h-screen bg-slate-50 flex">
        {collapsed && <div className="hidden lg:block shrink-0 w-[76px]" aria-hidden="true" />}
        <Sidebar
          current={page}
          onNavigate={setPage}
          collapsed={collapsed && !hovering}
          pinnedCollapsed={collapsed}
          onHoverChange={setHovering}
          onToggle={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          userName={userName}
          isAdmin={isAdmin}
          onSignOut={onSignOut}
          onOpenAdmin={onOpenAdmin}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar
            title={TITLES[page]}
            onOpenMobile={() => setMobileOpen(true)}
            search={search}
            onSearch={setSearch}
            onBack={goBack}
            onForward={goForward}
            canBack={canBack}
            canForward={canForward}
          />
          <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
            {loading ? (
              <Card>
                <EmptyState icon={Clock} title="Carregando seus dados…" subtitle="Buscando informações no banco de dados." />
              </Card>
            ) : (
              renderPage()
            )}
          </main>
        </div>
      </div>
    </StoreContext.Provider>
  );
}
