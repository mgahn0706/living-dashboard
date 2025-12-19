import { IconBrandGithub, IconSoccerField } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <IconSoccerField className="size-4" />
          </div>
          <h1 className="text-base font-medium">Match Dashboard</h1>
        </div>

        {/* Right: Actions & Sidebar Trigger */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            asChild
            size="sm"
            className="hidden sm:flex gap-2 text-muted-foreground"
          >
            <a
              href="https://github.com/shadcn-ui/ui/tree/main/apps/v4/app/(examples)/dashboard"
              rel="noopener noreferrer"
              target="_blank"
            >
              <IconBrandGithub className="size-4" />
              <span>GitHub</span>
            </a>
          </Button>

          <Separator orientation="vertical" className="mx-1 h-4" />

          {/* Trigger for Right Sidebar */}
          <SidebarTrigger className="-mr-1" />
        </div>
      </div>
    </header>
  );
}
