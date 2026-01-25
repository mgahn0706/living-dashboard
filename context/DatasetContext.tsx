"use client";

import React, { createContext, useContext, useRef, useState } from "react";

/* =====================================================
   Types
===================================================== */

export type SchemaNode = {
  type: "object" | "array" | "primitive";
  children?: Record<string, SchemaNode>;
};

type DatasetContextType = {
  rawData: any;
  attributeKeys: string[];
  schema: SchemaNode | null;
  resolveAttribute: (attr: string) => any[];
  uploadDataset: (file: File) => Promise<void>;
};

/* =====================================================
   Context
===================================================== */

const DatasetContext = createContext<DatasetContextType | null>(null);

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) {
    throw new Error("useDataset must be used within DatasetProvider");
  }
  return ctx;
}

/* =====================================================
   Utils
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

function getValuesByAttribute(data: any, attr: string): any[] {
  if (!Array.isArray(data)) return [];

  return data.map((row) => {
    return attr.split(".").reduce((acc, key) => {
      if (acc == null) return undefined;
      return acc[key];
    }, row);
  });
}

function buildSchema(value: unknown): SchemaNode {
  if (Array.isArray(value)) {
    const merged: Record<string, SchemaNode> = {};
    value.forEach((item) => {
      const s = buildSchema(item);
      if (s.type === "object" && s.children) {
        Object.entries(s.children).forEach(([k, v]) => {
          if (!merged[k]) merged[k] = v;
        });
      }
    });
    return { type: "array", children: merged };
  }

  if (typeof value === "object" && value !== null) {
    const children: Record<string, SchemaNode> = {};
    Object.entries(value).forEach(([k, v]) => {
      children[k] = buildSchema(v);
    });
    return { type: "object", children };
  }

  return { type: "primitive" };
}

function parseCSV(text: string): Record<string, any>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, any> = {};
    headers.forEach((h, i) => (row[h] = values[i]));
    return row;
  });
}

/* =====================================================
   Provider
===================================================== */

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [rawData, setRawData] = useState<any>(null);
  const [attributeKeys, setAttributeKeys] = useState<string[]>([]);
  const [schema, setSchema] = useState<SchemaNode | null>(null);

  const uploadDataset = async (file: File) => {
    const text = await file.text();
    let data: any;

    if (file.name.endsWith(".json")) {
      data = JSON.parse(text);
    } else if (file.name.endsWith(".csv")) {
      data = parseCSV(text);
    } else {
      throw new Error("Unsupported file type");
    }

    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid data");
    }

    const flatKeys = Array.from(extractKeysRecursive(data)).sort();
    const hierarchicalSchema = buildSchema(data);

    setRawData(data);
    setAttributeKeys(flatKeys);
    setSchema(hierarchicalSchema);

    console.log("Dataset loaded");
    console.log("Attributes:", flatKeys);
    console.log("Schema:", hierarchicalSchema);
  };

  const clearDataset = () => {
    setRawData(null);
    setAttributeKeys([]);
    setSchema(null);
  };

  const resolveAttribute = (attr: string) =>
    getValuesByAttribute(rawData, attr);

  return (
    <DatasetContext.Provider
      value={{
        rawData,
        attributeKeys,
        schema,
        resolveAttribute,
        uploadDataset,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}
