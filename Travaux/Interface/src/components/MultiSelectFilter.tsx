import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ReactNode } from "react";

type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectFilterProps = {
  title: string;
  options: MultiSelectOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  emptyText: string;
  selectAllText: string;
  clearSelectionText: string;
  headerAction?: ReactNode;
  renderOptionActions?: (option: MultiSelectOption) => ReactNode;
};

export function MultiSelectFilter({
  title,
  options,
  selected,
  onChange,
  emptyText,
  selectAllText,
  clearSelectionText,
  headerAction,
  renderOptionActions,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (open && wrapperRef.current && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const toggleOne = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  };

  const toggleAll = () => {
    const allSelected = options.length > 0 && selected.size === options.length;
    if (allSelected) {
      onChange(new Set());
      return;
    }
    onChange(new Set(options.map((opt) => opt.value)));
  };

  return (
    <div ref={wrapperRef} className="relative self-end">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>
              {title} {selected.size > 0 && `(${selected.size})`}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background p-2 shadow-md">
          {options.length === 0 ? (
            <div className="text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 py-1">
                <button type="button" className="text-left text-xs font-medium text-primary" onClick={toggleAll}>
                  {selected.size === options.length ? clearSelectionText : selectAllText}
                </button>
                {headerAction}
              </div>
              {options.map((option) => (
                <div key={option.value} className="flex items-center gap-2 py-1">
                  <Checkbox checked={selected.has(option.value)} onCheckedChange={() => toggleOne(option.value)} />
                  <button
                    type="button"
                    className="text-sm text-left cursor-pointer flex-1"
                    onClick={() => toggleOne(option.value)}
                  >
                    {option.label}
                  </button>
                  {renderOptionActions ? (
                    <div className="flex items-center gap-1">{renderOptionActions(option)}</div>
                  ) : null}
                </div>
              ))}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
