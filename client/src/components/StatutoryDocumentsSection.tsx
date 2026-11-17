import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  COUNTERPARTY_VAT_TYPES,
  STATUTORY_REQUIREMENTS,
  type CounterpartyVatType,
} from "@shared/counterpartyVat";
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface StatutoryDocumentsSectionProps {
  counterpartyId: number;
  vatType?: CounterpartyVatType | null;
  counterpartyName?: string;
  compact?: boolean;
}

const acceptedScanTypes = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx";
const maxSize = 15 * 1024 * 1024;

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export function StatutoryDocumentsSection({
  counterpartyId,
  vatType = "with_vat",
  counterpartyName,
  compact = false,
}: StatutoryDocumentsSectionProps) {
  const currentVatType: CounterpartyVatType = vatType === "without_vat" ? "without_vat" : "with_vat";
  const vatMeta = COUNTERPARTY_VAT_TYPES[currentVatType];
  const requirements = STATUTORY_REQUIREMENTS[currentVatType];

  const generalInputRef = useRef<HTMLInputElement | null>(null);
  const targetedInputRef = useRef<HTMLInputElement | null>(null);
  const [targetDocTitle, setTargetDocTitle] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: attachments = [], isLoading } = trpc.attachments.list.useQuery(
    {
      entityType: "counterparty",
      entityId: counterpartyId,
      documentKind: "statutory_document",
    },
    { enabled: Boolean(counterpartyId) },
  );

  const createMutation = trpc.attachments.create.useMutation({
    onSuccess: () => {
      utils.attachments.list.invalidate({
        entityType: "counterparty",
        entityId: counterpartyId,
        documentKind: "statutory_document",
      });
      toast.success("Документ успешно загружен");
      setTargetDocTitle(null);
      if (generalInputRef.current) generalInputRef.current.value = "";
      if (targetedInputRef.current) targetedInputRef.current.value = "";
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.attachments.delete.useMutation({
    onSuccess: () => {
      utils.attachments.list.invalidate({
        entityType: "counterparty",
        entityId: counterpartyId,
        documentKind: "statutory_document",
      });
      toast.success("Документ удален");
    },
    onError: (error) => toast.error(error.message),
  });

  async function handleUpload(file?: File, prefixTitle?: string) {
    if (!file || !counterpartyId) return;
    if (file.size > maxSize) {
      toast.error("Файл слишком большой. Максимум 15 МБ");
      return;
    }

    try {
      const dataUrl = await readAsDataUrl(file);
      const fileName = prefixTitle ? `[${prefixTitle}] ${file.name}` : file.name;

      createMutation.mutate({
        entityType: "counterparty",
        entityId: counterpartyId,
        documentKind: "statutory_document",
        fileName,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось прикрепить файл";
      toast.error(message);
    }
  }

  function openAttachment(dataUrl?: string | null, id?: number, fileName?: string) {
    const url = dataUrl ?? `/api/attachments/${id}/file`;
    const win = window.open("", "_blank");
    if (!win) {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "document";
      link.click();
      return;
    }
    win.document.write(`<iframe src="${url}" style="border:0;width:100%;height:100vh" title="${fileName}"></iframe>`);
    win.document.close();
  }

  function downloadAttachment(dataUrl?: string | null, id?: number, fileName?: string) {
    const url = dataUrl ?? `/api/attachments/${id}/file`;
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Count matches
  const requiredList = requirements.filter((req) => req.required);
  const uploadedMatchingCount = requiredList.filter((req) =>
    attachments.some(
      (att) =>
        att.fileName.toLowerCase().includes(req.title.toLowerCase().slice(0, 8)) ||
        att.fileName.includes(`[${req.title}]`),
    ),
  ).length;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
      {/* Header with VAT info and completeness badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-semibold text-foreground">
              Уставные документы
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${vatMeta.badgeColor}`}
            >
              {vatMeta.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {vatMeta.description}. Проверка пакета документов контрагента перед сделками.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={createMutation.isPending}
            onClick={() => generalInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Загрузить документ
          </Button>
          <input
            ref={generalInputRef}
            type="file"
            accept={acceptedScanTypes}
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* Checklist section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Требуемый перечень документов ({vatMeta.shortLabel})
          </span>
          <span className="text-xs text-muted-foreground">
            {uploadedMatchingCount > 0 ? (
              <span className="text-emerald-700 font-medium">
                {uploadedMatchingCount} из {requiredList.length} обязательных
              </span>
            ) : (
              `${requiredList.length} обязательных`
            )}
          </span>
        </div>

        <div className="space-y-2">
          {requirements.map((req) => {
            const uploadedMatches = attachments.filter(
              (att) =>
                att.fileName.toLowerCase().includes(req.title.toLowerCase().slice(0, 8)) ||
                att.fileName.includes(`[${req.title}]`),
            );
            const isUploaded = uploadedMatches.length > 0;

            return (
              <div
                key={req.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border text-sm gap-2 transition-colors ${
                  isUploaded
                    ? "bg-emerald-50/60 border-emerald-200/80 text-foreground"
                    : req.required
                    ? "bg-amber-50/40 border-amber-200/60 text-foreground"
                    : "bg-muted/20 border-border/50 text-muted-foreground"
                }`}
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  {isUploaded ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : req.required ? (
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs sm:text-sm">
                        {req.title}
                      </span>
                      {req.required && (
                        <span className="text-[10px] uppercase font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                          Обязательно
                        </span>
                      )}
                    </div>
                    {req.hint && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {req.hint}
                      </p>
                    )}
                    {isUploaded && (
                      <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1.5 flex-wrap">
                        <FileCheck className="h-3 w-3" />
                        {uploadedMatches.map((m) => (
                          <span key={m.id} className="underline cursor-pointer" onClick={() => openAttachment(m.dataUrl, m.id, m.fileName)}>
                            {m.fileName.replace(`[${req.title}] `, "")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {!isUploaded && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 self-start sm:self-center shrink-0"
                    onClick={() => {
                      setTargetDocTitle(req.title);
                      targetedInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Прикрепить
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Hidden input for specific requirement upload */}
        <input
          ref={targetedInputRef}
          type="file"
          accept={acceptedScanTypes}
          className="hidden"
          onChange={(e) => {
            if (targetDocTitle) {
              handleUpload(e.target.files?.[0], targetDocTitle);
            }
          }}
        />
      </div>

      {/* List of all uploaded files */}
      <div className="border-t border-border/60 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Загруженные файлы архива ({attachments.length})
          </span>
        </div>

        {attachments.length === 0 ? (
          <div className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-lg text-center">
            Документы пока не загружены. Прикрепите файлы согласно списку выше.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 rounded-lg bg-background border border-border text-xs group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate font-medium text-foreground">
                    {file.fileName}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    title="Просмотреть"
                    onClick={() => openAttachment(file.dataUrl, file.id, file.fileName)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    title="Скачать"
                    onClick={() => downloadAttachment(file.dataUrl, file.id, file.fileName)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    title="Удалить"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate({ id: file.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
