"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import * as XLSX from "xlsx";

/* =====================================================
   Types
===================================================== */

export type PrimitiveType = "string" | "number" | "date" | "unknown";

export type SchemaNode = {
  type: "object" | "array" | "primitive";
  children?: Record<string, SchemaNode>;
};

type DatasetContextType = {
  rawData: any;
  attributeKeys: string[];
  attributeTypes: Record<string, PrimitiveType>;
  schema: SchemaNode | null;
  resolveAttribute: (attr: string) => any[];
  uploadDataset: (file: File) => Promise<void>;
  loadDemoDataset: () => Promise<void>;
  restoreDataset: (data: unknown) => void;
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

  return data.map((row) =>
    attr.split(".").reduce((acc, key) => {
      if (acc == null) return undefined;
      return acc[key];
    }, row)
  );
}

/* ---------- schema ---------- */

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

/* ---------- csv ---------- */

function parseCSV(text: string): Record<string, any>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Auto-detect delimiter
  const firstLine = lines[0];
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolons > commas ? ";" : ",";
  const europeanDecimal = delimiter === ";";

  const headers = firstLine.split(delimiter).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => {
      let s = v.trim();
      // Strip CSV quoting
      if (s.startsWith('"') && s.endsWith('"')) {
        s = s.slice(1, -1).replace(/""/g, '"');
      }
      return s;
    });

    const row: Record<string, any> = {};
    headers.forEach((h, i) => {
      const raw = values[i] ?? "";
      if (raw !== "" && /^-?\d[\d.,]*$/.test(raw)) {
        const numCandidate = europeanDecimal ? raw.replace(",", ".") : raw;
        const n = Number(numCandidate);
        if (!Number.isNaN(n)) {
          row[h] = n;
          return;
        }
      }
      row[h] = raw;
    });
    return row;
  });
}

/* ---------- xlsx ---------- */

function parseXLSX(buffer: ArrayBuffer): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
}

/* ---------- type detection ---------- */

function detectPrimitiveType(values: any[]): PrimitiveType {
  const filtered = values.filter(
    (v) => v !== null && v !== undefined && v !== ""
  );

  if (filtered.length === 0) return "unknown";

  let numberCount = 0;
  let dateCount = 0;

  filtered.forEach((v) => {
    if (typeof v === "number") {
      numberCount++;
      return;
    }

    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) {
        numberCount++;
        return;
      }

      const d = Date.parse(v);
      if (!Number.isNaN(d)) {
        dateCount++;
        return;
      }
    }
  });

  const ratio = filtered.length * 0.7;

  if (numberCount >= ratio) return "number";
  if (dateCount >= ratio) return "date";
  return "string";
}

/* =====================================================
   Provider
===================================================== */

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [rawData, setRawData] = useState<any>(null);
  const [attributeKeys, setAttributeKeys] = useState<string[]>([]);
  const [attributeTypes, setAttributeTypes] = useState<
    Record<string, PrimitiveType>
  >({});
  const [schema, setSchema] = useState<SchemaNode | null>(null);

  const ingestData = (data: any) => {
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid data");
    }

    const flatKeys = Array.from(extractKeysRecursive(data)).sort();
    const hierarchicalSchema = buildSchema(data);

    const typeMap: Record<string, PrimitiveType> = {};
    flatKeys.forEach((key) => {
      const values = getValuesByAttribute(data, key);
      typeMap[key] = detectPrimitiveType(values);
    });

    setRawData(data);
    setAttributeKeys(flatKeys);
    setAttributeTypes(typeMap);
    setSchema(hierarchicalSchema);
  };

  const uploadDataset = async (file: File) => {
    const text = await file.text();
    let data: any;

    if (file.name.endsWith(".json")) {
      data = JSON.parse(text);
    } else if (file.name.endsWith(".csv")) {
      data = parseCSV(text);
    } else if (file.name.endsWith(".xlsx")) {
      const buffer = await file.arrayBuffer();
      data = parseXLSX(buffer);
    } else {
      throw new Error("Unsupported file type");
    }

    ingestData(data);
  };

  const loadDemoDataset = async () => {
    const res = await fetch("/data/Revenue.csv");
    const text = await res.text();
    const parsed = parseCSV(text);
    ingestData(parsed);
  };

  const resolveAttribute = useCallback(
    (attr: string) => getValuesByAttribute(rawData, attr),
    [rawData]
  );

  return (
    <DatasetContext.Provider
      value={{
        rawData,
        attributeKeys,
        attributeTypes,
        schema,
        resolveAttribute,
        uploadDataset,
        loadDemoDataset,
        restoreDataset: ingestData,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}
