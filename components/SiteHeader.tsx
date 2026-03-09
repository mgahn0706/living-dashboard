"use client";

import { useRef } from "react";
import {
  IconBrandGithub,
  IconDashboard,
  IconDeviceFloppy,
  IconUpload,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Toggle } from "@/components/ui/toggle";
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
}

export function SiteHeader({
  isAutoSaveEnabled = false,
  onAutoSaveToggle,
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

          {hasDataset && (
            <span className="text-xs text-muted-foreground">
              {attributeKeys.length} attributes
            </span>
          )}

          {onAutoSaveToggle && (
            <Toggle
              size="sm"
              pressed={isAutoSaveEnabled}
              onPressedChange={onAutoSaveToggle}
              aria-label="Toggle auto save"
              className="hidden sm:flex gap-2 text-muted-foreground"
            >
              <IconDeviceFloppy className="size-4" />
              <span>Auto Save (1m)</span>
            </Toggle>
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
