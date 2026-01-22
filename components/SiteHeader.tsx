import { useRef, useState } from "react";
import {
  IconBrandGithub,
  IconDashboard,
  IconUpload,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/* =====================================================
   Types for LLM-friendly schema
===================================================== */

type SchemaNode = {
  type: "object" | "array" | "primitive";
  children?: Record<string, SchemaNode>;
};

/* =====================================================
   Recursive flat key extraction (arrays included)
===================================================== */

function extractKeysRecursive(
  value: unknown,
  prefix = "",
  acc = new Set<string>()
): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => extractKeysRecursive(item, prefix, acc));
    return acc;
  }

  if (typeof value === "object" && value !== null) {
    Object.entries(value).forEach(([key, val]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      acc.add(path);
      extractKeysRecursive(val, path, acc);
    });
  }

  return acc;
}

/* =====================================================
   Recursive hierarchical schema builder
===================================================== */

function buildSchema(value: unknown): SchemaNode {
  if (Array.isArray(value)) {
    const mergedChildren: Record<string, SchemaNode> = {};

    value.forEach((item) => {
      const childSchema = buildSchema(item);
      if (childSchema.type === "object" && childSchema.children) {
        Object.entries(childSchema.children).forEach(([key, node]) => {
          if (!mergedChildren[key]) {
            mergedChildren[key] = node;
          }
        });
      }
    });

    return {
      type: "array",
      children: mergedChildren,
    };
  }

  if (typeof value === "object" && value !== null) {
    const children: Record<string, SchemaNode> = {};
    Object.entries(value).forEach(([key, val]) => {
      children[key] = buildSchema(val);
    });

    return {
      type: "object",
      children,
    };
  }

  return { type: "primitive" };
}

/* =====================================================
   SiteHeader
===================================================== */

export function SiteHeader() {
  /** Flat attribute paths */
  const [attributeKeys, setAttributeKeys] = useState<string[]>([]);

  /** Hierarchical schema for LLM */
  const [schema, setSchema] = useState<SchemaNode | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (typeof json !== "object" || json === null) {
        throw new Error("Invalid JSON root");
      }

      // 1️⃣ flat keys
      const flatKeys = Array.from(extractKeysRecursive(json)).sort();

      // 2️⃣ hierarchical schema
      const hierarchicalSchema = buildSchema(json);

      setAttributeKeys(flatKeys);
      setSchema(hierarchicalSchema);

      // 🔍 Debug only
      console.log("Flat attribute keys:", flatKeys);
      console.log("Hierarchical schema (LLM-ready):", hierarchicalSchema);
    } catch (err) {
      alert("Invalid JSON file");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center border-b bg-background">
      <div className="flex w-full items-center px-4 lg:px-6">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <IconDashboard className="size-4" />
          </div>
          <h1 className="text-base font-medium">Living Dashboard</h1>
        </div>

        {/* Right: Actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Upload JSON */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex gap-2 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload className="size-4" />
            <span>Upload JSON</span>
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Debug indicator */}
          {attributeKeys.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {attributeKeys.length} attributes
            </span>
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
