import { supabase } from "@/integrations/supabase/client";

/* ============================================================================
   MAPEAMENTO ENTRE O ESTADO DO APP E AS TABELAS DO BANCO
============================================================================ */

const norm = (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function matchSearch(search, ...fields) {
  const q = norm(search).trim();
  if (!q) return true;
  return fields.some((f) => norm(f).includes(q));
}

const clientMap = {
  table: "clients",
  toRow: (c) => ({ id: c.id, name: c.name ?? "", phone: c.phone ?? "", email: c.email ?? "" }),
  fromRow: (r) => ({ id: r.id, name: r.name, phone: r.phone, email: r.email }),
};

const supplierMap = { ...clientMap, table: "suppliers" };

const productMap = {
  table: "products",
  toRow: (p) => ({ id: p.id, name: p.name ?? "", kind: p.kind ?? "produto", bom: p.bom ?? [] }),
  fromRow: (r) => ({ id: r.id, name: r.name, kind: r.kind, bom: r.bom ?? [] }),
};

const transactionMap = {
  table: "transactions",
  toRow: (t) => ({
    id: t.id,
    date: t.date ?? "",
    description: t.description ?? "",
    value: Number(t.value) || 0,
    type: t.type ?? "entrada",
    category: t.category ?? "",
    payment_method: t.paymentMethod ?? "",
    client: t.client ?? "",
    has_receipt: !!t.hasReceipt,
  }),
  fromRow: (r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    value: Number(r.value) || 0,
    type: r.type,
    category: r.category,
    paymentMethod: r.payment_method,
    client: r.client,
    hasReceipt: r.has_receipt,
  }),
};

const orcamentoMap = {
  table: "orcamentos",
  toRow: (o) => ({
    id: o.id,
    numero: Number(o.numero) || 0,
    client_id: o.clientId ?? "",
    client_name: o.clientName ?? "",
    client_phone: o.clientPhone ?? "",
    client_email: o.clientEmail ?? "",
    items: o.items ?? [],
    total: Number(o.total) || 0,
    status: o.status ?? "pendente",
    date: o.createdAt ?? "",
  }),
  fromRow: (r) => ({
    id: r.id,
    numero: r.numero,
    clientId: r.client_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    clientEmail: r.client_email,
    items: r.items ?? [],
    total: Number(r.total) || 0,
    status: r.status,
    createdAt: r.date,
  }),
};

const pedidoMap = {
  table: "pedidos",
  toRow: (p) => ({
    id: p.id,
    numero: String(p.numero),
    orcamento_id: p.orcamentoId ?? "",
    orcamento_numero: Number(p.orcamentoNumero) || 0,
    client_name: p.clientName ?? "",
    items: p.items ?? [],
    total: Number(p.total) || 0,
    status: p.status ?? "em_producao",
    transaction_id: p.transactionId ?? null,
    finalized_at: p.finalizedAt ?? null,
    date: p.createdAt ?? "",
  }),
  fromRow: (r) => ({
    id: r.id,
    numero: r.numero,
    orcamentoId: r.orcamento_id,
    orcamentoNumero: r.orcamento_numero,
    clientName: r.client_name,
    items: r.items ?? [],
    total: Number(r.total) || 0,
    status: r.status,
    transactionId: r.transaction_id,
    finalizedAt: r.finalized_at,
    createdAt: r.date,
  }),
};

const COLLECTIONS = {
  clients: clientMap,
  suppliers: supplierMap,
  products: productMap,
  transactions: transactionMap,
  orcamentos: orcamentoMap,
  pedidos: pedidoMap,
};

/* ============================================================================
   CARGA INICIAL
============================================================================ */
export async function hydrateState() {
  const entries = await Promise.all(
    Object.entries(COLLECTIONS).map(async ([key, map]) => {
      const { data, error } = await supabase
        .from(map.table)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return [key, (data ?? []).map(map.fromRow)];
    })
  );
  return Object.fromEntries(entries);
}

/* ============================================================================
   ESCRITA (por ação do reducer)
============================================================================ */
const INSERTS = {
  ADD_CLIENT: "clients",
  ADD_SUPPLIER: "suppliers",
  ADD_PRODUCT: "products",
  ADD_TRANSACTION: "transactions",
  ADD_ORCAMENTO: "orcamentos",
  ADD_PEDIDO: "pedidos",
};

const DELETES = {
  DELETE_CLIENT: "clients",
  DELETE_SUPPLIER: "suppliers",
  DELETE_PRODUCT: "products",
  DELETE_TRANSACTION: "transactions",
  DELETE_ORCAMENTO: "orcamentos",
  DELETE_PEDIDO: "pedidos",
};

export async function persistAction(action, userId) {
  if (!userId) return;

  const insertKey = INSERTS[action.type];
  if (insertKey) {
    const map = COLLECTIONS[insertKey];
    const { error } = await supabase
      .from(map.table)
      .insert({ ...map.toRow(action.payload), user_id: userId });
    if (error) throw error;
    return;
  }

  const deleteKey = DELETES[action.type];
  if (deleteKey) {
    const map = COLLECTIONS[deleteKey];
    const { error } = await supabase.from(map.table).delete().eq("id", action.payload);
    if (error) throw error;
    return;
  }

  if (action.type === "SET_ORCAMENTO_STATUS") {
    const { error } = await supabase
      .from("orcamentos")
      .update({ status: action.payload.status })
      .eq("id", action.payload.id);
    if (error) throw error;
    return;
  }

  if (action.type === "SET_PEDIDO_STATUS") {
    const patch = action.payload.patch || {};
    const row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.finalizedAt !== undefined) row.finalized_at = patch.finalizedAt;
    if (patch.transactionId !== undefined) row.transaction_id = patch.transactionId;
    const { error } = await supabase.from("pedidos").update(row).eq("id", action.payload.id);
    if (error) throw error;
  }
}
