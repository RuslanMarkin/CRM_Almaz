import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, Eye, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

type AttachmentEntityType = "contract" | "specification" | "counterparty" | "organization";
type AttachmentDocumentKind = "contract_scan" | "specification_scan" | "statutory_document" | "other";

interface ScanAttachmentsProps {
  entityType: AttachmentEntityType;
  entityId?: number | null;
  documentKind?: AttachmentDocumentKind;
  specificationId?: number | null;
  title?: string;
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

export function ScanAttachments({
  entityType,
  entityId,
  documentKind,
  specificationId,
  title = "Сканы",
  compact = false,
}: ScanAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const utils = trpc.useUtils();
  const enabled = Boolean(entityId);

  const { data: attachments = [], isLoading } = trpc.attachments.list.useQuery(
    {
      entityType,
      entityId: entityId ?? 0,
      documentKind,
      specificationId: specificationId ?? undefined,
    },
    { enabled },
  );

  const createMutation = trpc.attachments.create.useMutation({
    onSuccess: () => {
      utils.attachments.list.invalidate({ entityType, entityId: entityId ?? 0, documentKind, specificationId: specificationId ?? undefined });
      toast.success("Скан прикреплён");
      if (inputRef.current) inputRef.current.value = "";
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.attachments.delete.useMutation({
    onSuccess: () => {
      utils.attachments.list.invalidate({ entityType, entityId: entityId ?? 0, documentKind, specificationId: specificationId ?? undefined });
      toast.success("Скан удалён");
    },
    onError: (error) => toast.error(error.message),
  });

  async function handleFile(file?: File) {
    if (!file || !entityId) return;
    if (file.size > maxSize) {
      toast.error("Файл слишком большой. Максимум 15 МБ");
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      createMutation.mutate({
        entityType,
        entityId,
        documentKind,
        specificationId: specificationId ?? undefined,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось прикрепить файл";
      toast.error(message);
    }
  }

  function openAttachment(dataUrl: string, fileName: string) {
    const win = window.open("", "_blank");
    if (!win) {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      link.click();
      return;
    }
    win.document.write(`<iframe src="${dataUrl}" style="border:0;width:100%;height:100vh" title="${fileName}"></iframe>`);
    win.document.close();
  }

  function getAttachmentUrl(attachment: (typeof attachments)[number]) {
    return attachment.dataUrl ?? `/api/attachments/${attachment.id}/file`;
  }

  return (
    <div className={compact ? "rounded-lg border border-border p-3" : "rounded-xl border border-border p-4"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? `${attachments.length} файл(ов)` : "Сохраните запись, чтобы прикрепить скан"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!enabled || createMutation.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Прикрепить
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={acceptedScanTypes}
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      {enabled && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Загрузка сканов...</p>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Сканов пока нет</p>
          ) : (
            attachments.map((attachment) => {
              const attachmentUrl = getAttachmentUrl(attachment);
              return (
              <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{attachment.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => openAttachment(attachmentUrl, attachment.fileName)}
                    title="Открыть"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <a
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    href={attachmentUrl}
                    download={attachment.fileName}
                    title="Скачать"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ id: attachment.id })}
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
