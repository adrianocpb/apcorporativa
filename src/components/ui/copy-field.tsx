"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/** Campo somente leitura com botão de copiar (ex.: link de convite). */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o usuário pode selecionar o texto.
    }
  }
  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="font-mono text-small"
      />
      <Button
        variant={copied ? "tonal" : "primary"}
        onClick={copy}
        icon={copied ? <IconCheck /> : <IconCopy />}
      >
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}
