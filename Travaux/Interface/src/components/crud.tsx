import { useState, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div>
        <h1 className="text-2xl font-bold">{t(title)}</h1>
        {description ? <p className="text-sm text-muted-foreground">{t(description)}</p> : null}
      </div>
      <div>{action}</div>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { t } = useI18n();
  return (
    <div className="relative max-w-sm mb-3">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input className="pl-8" placeholder={t(placeholder ?? "Buscar...")} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function FormDialog({
  trigger, title, open, onOpenChange, onSubmit, children, submitLabel = "Salvar",
}: {
  trigger?: ReactNode;
  title: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  onSubmit: () => unknown | Promise<unknown>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t(title)}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-3">
          {children}
          <DialogFooter><Button type="submit">{t(submitLabel)}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDelete({ onConfirm, label = "Excluir", iconOnly = true }: { onConfirm: () => void; label?: string; iconOnly?: boolean }) {
  const { t } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" aria-label={t(label)}>
          {iconOnly ? <Trash2 className="h-4 w-4" /> : t(label)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t("Confirmar exclusão")}</AlertDialogTitle><AlertDialogDescription>{t("Esta ação não pode ser desfeita.")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={onConfirm}>{t("Excluir")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function NewButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return <Button onClick={onClick}><Plus className="h-4 w-4 mr-1" /> {t("Novo")}</Button>;
}
