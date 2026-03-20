"use client";

import { useRef } from "react";
import { IconDownload, IconUpload, IconFilterOff } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { useDataset } from "@/context/DatasetContext";
import type { DecayMode } from "@/types/dashboard";

interface SiteHeaderProps {
  onExportDashboardState?: () => void;
  onResetAllFilters?: () => void;
  decayMode?: DecayMode;
  onDecayModeChange?: (mode: DecayMode) => void;
  isFocusScoreVisible?: boolean;
  onFocusScoreVisibilityChange?: (enabled: boolean) => void;
}

const DECAY_OPTIONS: { value: DecayMode; label: string }[] = [
  { value: "vignette", label: "Vignette" },
  { value: "shrink", label: "Shrink" },
  { value: "burn", label: "Burn" },
  { value: "dissolve", label: "Dissolve" },  
];

export function SiteHeader({
  onExportDashboardState,
  onResetAllFilters,
  decayMode = "vignette",
  onDecayModeChange,
  isFocusScoreVisible = false,
  onFocusScoreVisibilityChange,
}: SiteHeaderProps = {}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { attributeKeys, uploadDataset } = useDataset();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadDataset(file);
    } catch {
      alert("Invalid JSON / CSV / XLSX file");
    } finally {
      e.target.value = "";
    }
  };

  const hasDataset = attributeKeys.length > 0;

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center border-b bg-background">
      <div className="flex w-full items-center justify-end px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex gap-2 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload className="size-4" />
            <span>Upload JSON / CSV / XLSX</span>
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />

          {onExportDashboardState && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex gap-2 text-muted-foreground"
              onClick={onExportDashboardState}
            >
              <IconDownload className="size-4" />
              <span>Export State</span>
            </Button>
          )}

          {hasDataset && onResetAllFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex gap-2 text-muted-foreground"
              onClick={onResetAllFilters}
            >
              <IconFilterOff className="size-4" />
              <span>Reset Filters</span>
            </Button>
          )}

          {hasDataset && (
            <span className="text-xs text-muted-foreground">
              {attributeKeys.length} attributes
            </span>
          )}

          {hasDataset && onDecayModeChange && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
                {DECAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onDecayModeChange(opt.value)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors ${
                      decayMode === opt.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {hasDataset && onFocusScoreVisibilityChange && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <label className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <span>Explain the view change</span>
                <Switch
                  checked={isFocusScoreVisible}
                  onCheckedChange={onFocusScoreVisibilityChange}
                  aria-label="Toggle focus information display"
                />
              </label>
            </>
          )}

          <Separator orientation="vertical" className="mx-1 h-4" />
          <SidebarTrigger className="-mr-1" />
        </div>
      </div>
    </header>
  );
}
