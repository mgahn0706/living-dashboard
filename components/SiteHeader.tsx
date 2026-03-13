"use client";

import { useRef } from "react";
import {
  IconDownload,
  IconUpload,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDataset } from "@/context/DatasetContext";

interface SiteHeaderProps {
  onExportDashboardState?: () => void;
  onImportDashboardState?: (file: File) => Promise<void>;
  hasSavedDashboardState?: boolean;
  onLoadSavedDashboardState?: () => void;
}

export function SiteHeader({
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

          <Separator orientation="vertical" className="mx-1 h-4" />
          <SidebarTrigger className="-mr-1" />
        </div>
      </div>
    </header>
  );
}
