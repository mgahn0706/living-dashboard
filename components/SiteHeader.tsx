"use client";

import { useRef } from "react";
import {
  IconBrandGithub,
  IconDashboard,
  IconDownload,
  IconUpload,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDataset } from "@/context/DatasetContext";

interface SiteHeaderProps {
  isAutoSaveEnabled?: boolean;
  onAutoSaveToggle?: (enabled: boolean) => void;
  onExportDashboardState?: () => void;
  onImportDashboardState?: (file: File) => Promise<void>;
  hasSavedDashboardState?: boolean;
  onLoadSavedDashboardState?: () => void;
}

export function SiteHeader({
  isAutoSaveEnabled = false,
  onAutoSaveToggle,
  onExportDashboardState,
  onImportDashboardState,
  hasSavedDashboardState = false,
  onLoadSavedDashboardState,
}: SiteHeaderProps = {}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stateFileInputRef = useRef<HTMLInputElement>(null);
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

  const handleStateFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !onImportDashboardState) return;

    try {
      await onImportDashboardState(file);
    } catch {
      alert("Invalid dashboard state file");
    } finally {
      e.target.value = "";
    }
  };

  const hasDataset = attributeKeys.length > 0;

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center border-b bg-background">
      <div className="flex w-full items-center px-4 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <IconDashboard className="size-4" />
          </div>
          <h1 className="text-base font-medium">Living Dashboard</h1>
        </div>

        {/* Right */}
        <div className="ml-auto flex items-center gap-2">
          <TooltipProvider>
            <Tooltip open={!hasDataset} delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex gap-2 text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconUpload className="size-4" />
                  <span>Upload JSON / CSV / XLSX</span>
                </Button>
              </TooltipTrigger>

              {!hasDataset && (
                <TooltipContent side="bottom" align="end">
                  <p className="text-xs">Upload a dataset to start a meeting</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />

          {onImportDashboardState && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex gap-2 text-muted-foreground"
                onClick={() => stateFileInputRef.current?.click()}
              >
                <IconUpload className="size-4" />
                <span>Import State</span>
              </Button>

              <input
                ref={stateFileInputRef}
                type="file"
                accept=".json,.ldash"
                className="hidden"
                onChange={handleStateFileChange}
              />
            </>
          )}

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

          {hasDataset && hasSavedDashboardState && onLoadSavedDashboardState && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex gap-2 text-muted-foreground"
              onClick={onLoadSavedDashboardState}
            >
              <span>Load Saved View</span>
            </Button>
          )}

          {hasDataset && (
            <span className="text-xs text-muted-foreground">
              {attributeKeys.length} attributes
            </span>
          )}

          {onAutoSaveToggle && (
            <label className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <span>Auto Save (1m)</span>
              <Switch
                checked={isAutoSaveEnabled}
                onCheckedChange={onAutoSaveToggle}
                aria-label="Toggle auto save"
              />
            </label>
          )}

          <Button
            variant="ghost"
            asChild
            size="sm"
            className="hidden sm:flex gap-2 text-muted-foreground"
          >
            <a
              href="https://github.com/mgahn0706/living-dashboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBrandGithub className="size-4" />
              <span>GitHub</span>
            </a>
          </Button>

          <Separator orientation="vertical" className="mx-1 h-4" />
          <SidebarTrigger className="-mr-1" />
        </div>
      </div>
    </header>
  );
}
