import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Upload, Check } from "lucide-react";

export interface ContractRef {
  id: number;
  number: string;
  counterpartyId: number;
  contractKind?: "purchase" | "sale" | "carriage" | null;
}

export interface SpecEditingData {
  id: number;
  number: string;
  cargoName: string | null;
  volumeTotal: string | null;
  pricePerUnit: string | null;
  status: "draft" | "active" | "completed" | "cancelled";
  notes?: string | null;
  loadingAddress?: string | null;
  unloadingAddress?: string | null;
}

export interface AddContractSpecificationModalProps {
  open: boolean;
  onClose: () => void;
  contract: ContractRef | null;
  counterpartyName?: string;
  nextNumber?: string;
  editingSpec?: SpecEditingData | null;
  onSuccess?: () => void;
}

const COMMON_CROPS = [
  "Пшеница продовольственная 3 класс",
  "Пшеница 4 класс",
  "Ячмень яровой",
  "Кукуруза",
  "Подсолнечник",
  "Соя",
  "Рапс",
  "Горох",
];

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export function AddContractSpecificationModal({
  open,
  onClose,
  contract,
  counterpartyName,
  nextNumber = "1",
  editingSpec,
  onSuccess,
}: AddContractSpecificationModalProps) {
  const [number, setNumber] = useState("");
  const [cargoName, setCargoName] = useState("");
  const [volumeTotal, setVolumeTotal] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "completed" | "cancelled">("active");
  const [loadingAddress, setLoadingAddress] = useState("");
  const [unloadingAddress, setUnloadingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const utils = trpc.useUtils();
  const createSpecMutation = trpc.specifications.create.useMutation();
  const updateSpecMutation = trpc.specifications.update.useMutation();
  const createAttachmentMutation = trpc.attachments.create.useMutation();

  useEffect(() => {
    if (open) {
      if (editingSpec) {
        setNumber(editingSpec.number || "");
        setCargoName(editingSpec.cargoName || "");
        setVolumeTotal(editingSpec.volumeTotal ? String(editingSpec.volumeTotal) : "");
        setPricePerUnit(editingSpec.pricePerUnit ? String(editingSpec.pricePerUnit) : "");
        setStatus(editingSpec.status || "active");
        setLoadingAddress(editingSpec.loadingAddress || "");
        setUnloadingAddress(editingSpec.unloadingAddress || "");
        setNotes(editingSpec.notes || "");
        setSelectedFile(null);
      } else {
        setNumber(nextNumber);
        setCargoName("Пшеница продовольственная 3 класс");
        setVolumeTotal("");
        setPricePerUnit("");
        setStatus("active");
        setLoadingAddress("");
        setUnloadingAddress("");
        setNotes("");
        setSelectedFile(null);
      }
    }
  }, [open, editingSpec, nextNumber]);

  if (!open || !contract) return null;

  const numVolume = Number(volumeTotal) || 0;
  const numPrice = Number(pricePerUnit) || 0;
  const totalAmount = numVolume > 0 && numPrice > 0 ? numVolume * numPrice : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contract) return;
    const trimmedNumber = number.trim();
    if (!trimmedNumber) {
      toast.error("Укажите номер спецификации");
      return;
    }
    if (!volumeTotal || numVolume <= 0) {
      toast.error("Укажите корректный объём (тоннаж)");
      return;
    }
    if (!pricePerUnit || numPrice <= 0) {
      toast.error("Укажите корректную цену за тонну");
      return;
    }

    try {
      setSubmitting(true);
      if (editingSpec) {
        await updateSpecMutation.mutateAsync({
          id: editingSpec.id,
          data: {
            number: trimmedNumber,
            cargoName: cargoName.trim() || undefined,
            volumeTotal: volumeTotal.trim(),
            pricePerUnit: pricePerUnit.trim(),
            status,
            loadingAddress: loadingAddress.trim() || undefined,
            unloadingAddress: unloadingAddress.trim() || undefined,
            notes: notes.trim() || undefined,
          },
        });
        toast.success(`Спецификация № ${trimmedNumber} обновлена`);
      } else {
        const created = await createSpecMutation.mutateAsync({
          number: trimmedNumber,
          contractId: contract.id,
          counterpartyId: contract.counterpartyId,
          cargoName: cargoName.trim() || undefined,
          volumeTotal: volumeTotal.trim(),
          pricePerUnit: pricePerUnit.trim(),
          unit: "т",
          currency: "RUB",
          status,
          loadingAddress: loadingAddress.trim() || undefined,
          unloadingAddress: unloadingAddress.trim() || undefined,
          notes: notes.trim() || undefined,
        });

        const specId = created?.specification?.id;
        if (selectedFile && specId) {
          try {
            const dataUrl = await readAsDataUrl(selectedFile);
            await createAttachmentMutation.mutateAsync({
              entityType: "contract",
              entityId: contract.id,
              documentKind: "specification_scan",
              specificationId: specId,
              fileName: selectedFile.name,
              contentType: selectedFile.type || "application/octet-stream",
              size: selectedFile.size,
              dataUrl,
            });
            toast.success("Скан спецификации прикреплен");
          } catch (fileErr) {
            console.error(fileErr);
            toast.error("Спецификация создана, но файл скана не удалось загрузить");
          }
        }
        toast.success(`Спецификация № ${trimmedNumber} успешно создана`);
      }

      await Promise.all([
        utils.specifications.list.invalidate(),
        utils.attachments.list.invalidate(),
        utils.contracts.list.invalidate(),
      ]);

      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Произошла ошибка при сохранении";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="agro-dialog-backdrop"
      style={{ zIndex: 320, background: "rgba(11, 61, 58, 0.55)" }}
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="agro-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={editingSpec ? "Редактирование спецификации" : "Новая спецификация"}
        style={{ maxWidth: "580px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="agro-dialog-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
          <div>
            <div className="agro-dialog-kicker">
              {contract.contractKind === "purchase" ? "Закупка" : contract.contractKind === "sale" ? "Реализация" : "Перевозка"} · Договор № {contract.number}
            </div>
            <h2 style={{ margin: "2px 0 0", fontSize: "20px" }}>
              {editingSpec ? `Редактирование спецификации № ${editingSpec.number}` : "Новая спецификация"}
            </h2>
            {counterpartyName && (
              <div style={{ fontSize: "12.5px", color: "var(--soil-soft)", marginTop: "3px" }}>
                Контрагент: <b>{counterpartyName}</b>
              </div>
            )}
          </div>
          <button type="button" className="agro-icon-button" onClick={onClose} aria-label="Закрыть" title="Закрыть">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Row 1: Number and Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label className="agro-field">
              <span>Номер спецификации *</span>
              <input
                type="text"
                required
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="1"
                autoFocus
              />
            </label>

            <label className="agro-field">
              <span>Статус спецификации</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="active">Активна (в работе)</option>
                <option value="draft">Черновик</option>
                <option value="completed">Исполнена (прошлая)</option>
                <option value="cancelled">Отменена</option>
              </select>
            </label>
          </div>

          {/* Row 2: Cargo / Crop */}
          <div>
            <label className="agro-field">
              <span>Товар / Культура *</span>
              <input
                type="text"
                required
                value={cargoName}
                onChange={(e) => setCargoName(e.target.value)}
                placeholder="Например: Пшеница 3 класс"
              />
            </label>

            {/* Quick chips for crops */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
              {COMMON_CROPS.map((crop) => (
                <button
                  type="button"
                  key={crop}
                  onClick={() => setCargoName(crop)}
                  style={{
                    fontSize: "11px",
                    padding: "3px 8px",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    background: cargoName === crop ? "var(--soil)" : "#fff",
                    color: cargoName === crop ? "#fff" : "var(--soil)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {crop}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Tonnage and Price */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label className="agro-field">
              <span>Объём (тоннаж), т *</span>
              <input
                type="number"
                step="any"
                min="0.001"
                required
                value={volumeTotal}
                onChange={(e) => setVolumeTotal(e.target.value)}
                placeholder="500"
              />
            </label>

            <label className="agro-field">
              <span>Цена за тонну, ₽/т *</span>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                placeholder="14500"
              />
            </label>
          </div>

          {/* Real-time sum calculation */}
          {totalAmount > 0 && (
            <div
              style={{
                background: "var(--grain-subtle, #f8f6f0)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--soil-soft)" }}>
                Сумма по спецификации ({numVolume.toLocaleString("ru-RU")} т × {numPrice.toLocaleString("ru-RU")} ₽):
              </span>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--soil)" }}>
                {totalAmount.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          )}

          {/* File upload for new spec */}
          {!editingSpec && (
            <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--soil)", display: "block", marginBottom: "6px" }}>
                Скан спецификации (PDF, JPG, PNG, DOCX)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: "#fff",
                    color: "var(--soil)",
                    cursor: "pointer",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  <Upload size={14} />
                  <span>{selectedFile ? "Заменить файл" : "Выбрать скан..."}</span>
                  <input
                    type="file"
                    style={{ display: "none" }}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 15 * 1024 * 1024) {
                          toast.error("Файл слишком большой (макс. 15 МБ)");
                          return;
                        }
                        setSelectedFile(f);
                      }
                    }}
                  />
                </label>
                {selectedFile && (
                  <div style={{ fontSize: "12px", color: "var(--soil)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: 600 }}>{selectedFile.name}</span>
                    <span style={{ color: "var(--soil-soft)" }}>({(selectedFile.size / 1024 / 1024).toFixed(1)} МБ)</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "2px" }}
                      title="Удалить выбранный файл"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="agro-dialog-footer" style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", marginTop: "6px" }}>
            <button type="button" className="agro-btn ghost" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="agro-btn" disabled={submitting}>
              {submitting ? "Сохранение..." : editingSpec ? "Сохранить изменения" : "Добавить спецификацию"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
