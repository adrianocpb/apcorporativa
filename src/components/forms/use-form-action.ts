"use client";

import { useActionState } from "react";
import type { ActionState } from "@/server/actions";

export type FormState<T> = ActionState<T> & { values?: Record<string, string> };

/**
 * useActionState que guarda os valores enviados. O React limpa o formulário após cada
 * envio; com `values` + `key={state.at}` os campos voltam preenchidos quando há erro.
 * Campos de senha nunca são guardados.
 */
export function useFormAction<T>(
  action: (state: ActionState<T>, formData: FormData) => Promise<ActionState<T>>,
) {
  return useActionState<FormState<T>, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    const values: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && !/password/i.test(key) && !key.startsWith("$ACTION")) {
        values[key] = value;
      }
    }
    return { ...result, values };
  }, {});
}
