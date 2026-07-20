"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, Star, TrendingUp, TrendingDown, SlidersHorizontal } from "lucide-react";
import { usePatient } from "@/hooks/usePatients";
import { useRewardsAccount, useRewardsTransactions, useAdjustRewards } from "@/hooks/useRewards";
import { REWARDS_LEVEL_LABELS, REWARDS_LEVEL_COLORS, RewardsLevel } from "@/types";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

const TX_TYPE_LABELS: Record<string, string> = {
  visit: "Visita",
  on_time: "Puntualidad",
  cleaning: "Limpieza",
  treatment_completed: "Tratamiento completado",
  referral_completed: "Referido",
  review: "Reseña",
  consecutive_semesters: "Semestral",
  welcome: "Bienvenida",
  birthday_visit: "Cumpleaños",
  adjustment: "Ajuste manual",
};

const adjustTypeOptions = [
  { value: "manual_add", label: "Agregar puntos" },
  { value: "manual_deduct", label: "Descontar puntos" },
];

interface AdjustModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
}

function AdjustModal({ open, onClose, patientId }: AdjustModalProps) {
  const [txType, setTxType] = useState<"manual_add" | "manual_deduct">("manual_add");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");

  const adjust = useAdjustRewards(patientId, () => {
    setPoints("");
    setDescription("");
    setTxType("manual_add");
    onClose();
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = parseInt(points, 10);
    if (!p || p <= 0) return;
    adjust.mutate({ transaction_type: txType, points: p, description: description.trim() });
  }

  function handleClose() {
    setPoints("");
    setDescription("");
    setTxType("manual_add");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Ajuste manual de puntos" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Tipo de ajuste"
          value={txType}
          onChange={(e) => setTxType(e.target.value as "manual_add" | "manual_deduct")}
          options={adjustTypeOptions}
        />
        <Input
          label="Puntos *"
          type="number"
          min="1"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="Ej: 50"
          required
        />
        <Input
          label="Descripción *"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Motivo del ajuste..."
          required
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={adjust.isPending}
            disabled={!points || !description.trim()}
          >
            Aplicar ajuste
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PatientRewardsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: patient } = usePatient(id);
  const { data: account, isLoading: loadingAccount } = useRewardsAccount(id);
  const [page, setPage] = useState(1);
  const { data: txData, isLoading: loadingTx } = useRewardsTransactions(id, page);
  const [showAdjust, setShowAdjust] = useState(false);

  const transactions = txData?.data ?? [];
  const meta = txData?.meta;

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/patients/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft size={16} />
            {patient?.full_name ?? "Paciente"}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">Smile Rewards</h1>
        </div>
        {account && (
          <Button variant="secondary" size="sm" onClick={() => setShowAdjust(true)}>
            <SlidersHorizontal size={15} />
            Ajuste manual
          </Button>
        )}
      </div>

      {loadingAccount ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : !account ? (
        <div className="rounded-xl bg-white p-8 text-center text-slate-400 shadow-sm border border-slate-100">
          Este paciente no tiene cuenta Smile Rewards.
        </div>
      ) : (
        <>
          {/* Account card */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-50">
                  <Star size={28} className="text-yellow-500" />
                </div>
                <div>
                  <Badge
                    label={REWARDS_LEVEL_LABELS[account.level as RewardsLevel]}
                    className={`text-sm px-3 py-1 ${REWARDS_LEVEL_COLORS[account.level as RewardsLevel]}`}
                  />
                  <p className="mt-1 text-3xl font-bold text-slate-800">
                    {account.total_points.toLocaleString("es-NI")}
                    <span className="ml-2 text-base font-normal text-slate-400">puntos</span>
                  </p>
                </div>
              </div>

              {/* Progress to next level */}
              {account.progress.next_level && (
                <div className="w-64">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progreso hacia {REWARDS_LEVEL_LABELS[account.progress.next_level as RewardsLevel]}</span>
                    <span>{account.progress.progress_pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-yellow-400 transition-all"
                      style={{ width: `${account.progress.progress_pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Faltan {account.progress.points_needed?.toLocaleString("es-NI")} puntos
                  </p>
                </div>
              )}
            </div>

            {account.benefits_suspended && (
              <div className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                Beneficios suspendidos por inactividad mayor a 12 meses.
              </div>
            )}

            {account.last_visit_date && (
              <p className="mt-3 text-xs text-slate-400">
                Última visita: {format(parseISO(account.last_visit_date), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            )}
          </div>

          {/* Transactions */}
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Historial de transacciones</h2>
            </div>

            {loadingTx ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : transactions.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Sin transacciones registradas.
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-50">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          tx.points > 0
                            ? "bg-green-50 text-green-600"
                            : "bg-red-50 text-red-500"
                        )}
                      >
                        {tx.points > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {TX_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                        </p>
                        {tx.description && (
                          <p className="text-xs text-slate-400 truncate">{tx.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            tx.points > 0 ? "text-green-600" : "text-red-500"
                          )}
                        >
                          {tx.points > 0 ? "+" : ""}{tx.points}
                        </p>
                        <p className="text-xs text-slate-400">
                          {tx.balance_after.toLocaleString("es-NI")} total
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-400 shrink-0 w-20">
                        {format(parseISO(tx.created_at), "dd/MM/yy", { locale: es })}
                      </div>
                    </div>
                  ))}
                </div>

                {meta && meta.pages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                    <p className="text-xs text-slate-500">
                      Página {page} de {meta.pages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        ← Anterior
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page === meta.pages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Siguiente →
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <AdjustModal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        patientId={id}
      />
    </div>
  );
}
