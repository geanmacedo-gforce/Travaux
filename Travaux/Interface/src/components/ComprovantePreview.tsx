import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, ImageIcon } from "lucide-react";

function isPdf(path: string) {
  return path.toLowerCase().endsWith(".pdf");
}

function resolveComprovanteUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("data:") || path.startsWith("blob:")) return path;
  if (path.startsWith("/")) return path;
  return null;
}

function useSignedUrl(path: string | null | undefined, open: boolean) {
  const [url, setUrl] = useState<string | null>(resolveComprovanteUrl(path));
  useEffect(() => {
    if (!open) return;
    setUrl(resolveComprovanteUrl(path));
  }, [path, open]);
  return url;
}

export function ComprovanteThumb({ path }: { path: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const pdf = path ? isPdf(path) : false;

  useEffect(() => {
    if (!path || pdf) return;
    setThumb(resolveComprovanteUrl(path));
  }, [path, pdf]);

  if (!path) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block h-12 w-12 rounded border border-border overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition"
        title="Ver comprovante"
      >
        {pdf ? (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>
        ) : thumb ? (
          <img src={thumb} alt="Comprovante" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </button>
      <ComprovanteDialog path={path} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ComprovanteDialog({
  path, open, onOpenChange,
}: { path: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const url = useSignedUrl(path, open);
  const pdf = isPdf(path);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Comprovante</span>
            {url && (
              <Button asChild size="sm" variant="outline">
                <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" />Abrir</a>
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="w-full h-[75vh] bg-muted rounded overflow-auto flex items-center justify-center">
          {!url ? (
            <span className="text-sm text-muted-foreground">Carregando…</span>
          ) : pdf ? (
            <iframe src={url} title="Comprovante PDF" className="w-full h-full border-0" />
          ) : (
            <img src={url} alt="Comprovante" className="max-w-full max-h-full object-contain" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
