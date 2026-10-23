"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface CurrencyItem {
  code: string;
  name: string;
}

interface CurrencyComboboxProps {
  currencies: CurrencyItem[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function CurrencyCombobox({
  currencies,
  value,
  onChange,
  disabled,
  placeholder = "Select currency...",
  className,
}: CurrencyComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedCurrency = React.useMemo(
    () => currencies.find((c) => c.code.toUpperCase() === value?.toUpperCase()),
    [currencies, value]
  );

  const filteredCurrencies = React.useMemo(() => {
    if (!search.trim()) return currencies;
    const q = search.toLowerCase().trim();
    return currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    );
  }, [currencies, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          type="button"
          className={cn(
            "w-full justify-between font-normal text-left h-10 px-3",
            className
          )}
        >
          <span className="truncate">
            {selectedCurrency ? (
              <span>
                <strong className="font-semibold">{selectedCurrency.code}</strong>{" "}
                <span className="text-muted-foreground text-xs">
                  - {selectedCurrency.name}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">{value || placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0 shadow-md"
        align="start"
      >
        <Command shouldFilter={false} className="flex flex-col">
          <CommandInput
            placeholder="Search currency (code or name)..."
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList
            className="max-h-56 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.3)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"
            onWheelCapture={(e) => e.stopPropagation()}
          >
            {filteredCurrencies.length === 0 ? (
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                No currency found.
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredCurrencies.map((c) => {
                  const isSelected = c.code.toUpperCase() === value?.toUpperCase();
                  return (
                    <CommandItem
                      key={c.code}
                      value={`${c.code} ${c.name}`}
                      onSelect={() => {
                        onChange(c.code);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between py-2 px-2.5 cursor-pointer text-sm"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 text-primary",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-semibold text-xs tracking-wide bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                          {c.code}
                        </span>
                        <span className="text-xs text-foreground/80 truncate">
                          {c.name}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
