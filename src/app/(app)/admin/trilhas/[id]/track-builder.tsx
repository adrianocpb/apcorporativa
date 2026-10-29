"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGripVertical, IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toaster";
import { ContentTypeIcon } from "@/components/content/content-type-icon";
import { ConfirmActionButton } from "@/components/forms/action-buttons";
import { useFormAction } from "@/components/forms/use-form-action";
import { cn } from "@/lib/cn";
import { COMPLETION_RULE, CONTENT_TYPE } from "@/lib/labels";
import {
  addItemsAction,
  addModuleAction,
  deleteModuleAction,
  removeItemAction,
  reorderTrackAction,
  updateItemAction,
  updateModuleAction,
} from "../actions";

export type BuilderItem = {
  id: string;
  title: string;
  type: string;
  contentStatus: string;
  required: boolean;
  completionRule: string;
  rules: string[];
};
export type BuilderModule = { id: string; title: string; description: string | null; items: BuilderItem[] };
export type Addable = { id: string; title: string; type: string; category: string | null };

function DragHandle({ label, listeners, attributes }: { label: string; listeners: object | undefined; attributes: object }) {
  return (
    <button
      type="button"
      className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-muted hover:bg-surface-hover active:cursor-grabbing"
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <IconGripVertical className="size-[18px]" />
    </button>
  );
}

function Sortable({ id, children }: { id: string; children: (handle: ReactNode, dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-80")}
    >
      {children(<DragHandle label="Arrastar para reordenar (espaço para pegar, setas para mover)" listeners={listeners} attributes={attributes} />, isDragging)}
    </div>
  );
}

function ItemRow({
  trackId,
  item,
  handle,
  modules,
  currentModuleId,
  onMove,
}: {
  trackId: string;
  item: BuilderItem;
  handle: ReactNode;
  modules: BuilderModule[];
  currentModuleId: string;
  onMove: (itemId: string, targetModuleId: string) => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function save(patch: Partial<Pick<BuilderItem, "required" | "completionRule">>) {
    setSaving(true);
    const result = await updateItemAction(trackId, item.id, {
      required: patch.required ?? item.required,
      completionRule: patch.completionRule ?? item.completionRule,
    });
    setSaving(false);
    if (!result.ok) toast(result.message ?? "Não foi possível salvar.", "danger");
    router.refresh();
  }

  const unavailable = item.contentStatus !== "PUBLISHED";
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface px-4 py-3">
      {handle}
      <ContentTypeIcon type={item.type} size="sm" />
      <div className="min-w-[180px] flex-1">
        <p className="text-body font-medium text-ink">{item.title}</p>
        <p className="flex flex-wrap items-center gap-1 text-small text-ink-muted">
          {CONTENT_TYPE[item.type]?.label}
          {unavailable && <Badge tone="warning">Conteúdo arquivado — não conta</Badge>}
        </p>
      </div>
      <label className="flex items-center gap-2 text-small text-ink">
        <Checkbox checked={item.required} disabled={saving} onChange={(e) => save({ required: e.target.checked })} />
        Obrigatório
      </label>
      <Select
        aria-label={`Regra de conclusão de ${item.title}`}
        value={item.completionRule}
        disabled={saving}
        onChange={(e) => save({ completionRule: e.target.value })}
        className="h-[30px] w-auto! text-small"
      >
        {item.rules.map((r) => (
          <option key={r} value={r}>
            {COMPLETION_RULE[r]}
          </option>
        ))}
      </Select>
      {modules.length > 1 && (
        <Select
          aria-label={`Mover ${item.title} para outra etapa`}
          value=""
          onChange={(e) => e.target.value && onMove(item.id, e.target.value)}
          className="h-[30px] w-auto! text-small"
        >
          <option value="">Mover para…</option>
          {modules
            .filter((m) => m.id !== currentModuleId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
        </Select>
      )}
      <ConfirmActionButton
        action={removeItemAction.bind(null, trackId, item.id)}
        label="Remover"
        icon={<IconX />}
        variant="ghost"
        size="sm"
        title="Remover da trilha?"
        description={`“${item.title}” sai desta trilha. O conteúdo continua na biblioteca e as conclusões já registradas ficam no histórico.`}
        confirmLabel="Remover"
        confirmVariant="danger"
        successMessage="Conteúdo removido da trilha."
      />
    </div>
  );
}

function AddContentDialog({ trackId, moduleId, addable }: { trackId: string; moduleId: string; addable: Addable[] }) {
  const [state, formAction, pending] = useActionState(addItemsAction.bind(null, trackId, moduleId), {});
  const [openedWith, setOpenedWith] = useState<number | undefined | null>(null);
  const open = openedWith !== null && !(state.ok && state.at !== openedWith);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? addable.filter((c) => [c.title, c.category ?? ""].some((v) => v.toLowerCase().includes(q))) : addable;
  }, [addable, query]);

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state]);

  return (
    <>
      <Button size="sm" variant="tonal" icon={<IconPlus />} onClick={() => setOpenedWith(state.at)}>
        Adicionar conteúdo
      </Button>
      <Modal open={open} onOpenChange={(o) => setOpenedWith(o ? state.at : null)} title="Adicionar conteúdos" size="lg">
        {addable.length === 0 ? (
          <EmptyState
            title="Nenhum conteúdo disponível"
            description="Só conteúdos publicados podem entrar na trilha, e cada um apenas uma vez. Publique conteúdos em Administração → Conteúdos."
          />
        ) : (
          <form action={formAction} className="flex flex-col gap-3">
            {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por título ou categoria"
              aria-label="Filtrar conteúdos"
            />
            <fieldset className="max-h-80 overflow-y-auto rounded-md border border-line">
              <legend className="sr-only">Conteúdos publicados</legend>
              {addable.map((c) => (
                <label
                  key={c.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface-hover",
                    !filtered.includes(c) && "hidden",
                  )}
                >
                  <Checkbox name="contentIds" value={c.id} aria-label={c.title} />
                  <ContentTypeIcon type={c.type} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-body text-ink">{c.title}</span>
                    <span className="block text-small text-ink-muted">
                      {[CONTENT_TYPE[c.type]?.label, c.category].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button variant="tonal" onClick={() => setOpenedWith(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                Adicionar selecionados
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

function ModuleDialog({ trackId, module }: { trackId: string; module: BuilderModule }) {
  const [state, formAction, pending] = useFormAction(updateModuleAction.bind(null, trackId, module.id));
  const [openedWith, setOpenedWith] = useState<number | undefined | null>(null);
  const open = openedWith !== null && !(state.ok && state.at !== openedWith);
  return (
    <>
      <Button size="sm" variant="ghost" icon={<IconPencil />} onClick={() => setOpenedWith(state.at)}>
        Editar
      </Button>
      <Modal open={open} onOpenChange={(o) => setOpenedWith(o ? state.at : null)} title="Editar etapa">
        <form key={state.at ?? 0} action={formAction} className="flex flex-col gap-4" noValidate>
          {state.ok === false && state.message && <Alert tone="danger">{state.message}</Alert>}
          <Field label="Nome da etapa" name="title" required error={state.fieldErrors?.title}>
            {(p) => <Input {...p} defaultValue={state.values?.title ?? module.title} maxLength={120} autoFocus />}
          </Field>
          <Field label="Descrição" name="description" error={state.fieldErrors?.description}>
            {(p) => <Textarea {...p} defaultValue={state.values?.description ?? module.description ?? ""} rows={2} maxLength={500} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="tonal" onClick={() => setOpenedWith(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function NewModuleForm({ trackId }: { trackId: string }) {
  const [state, formAction, pending] = useFormAction(addModuleAction.bind(null, trackId));
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state]);
  return (
    <form key={state.at ?? 0} action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
      <Field label="Nova etapa" name="title" error={state.fieldErrors?.title} className="min-w-[240px] flex-1">
        {(p) => <Input {...p} defaultValue={state.ok === false ? state.values?.title : ""} placeholder="Ex.: Sistemas do dia a dia" maxLength={120} />}
      </Field>
      <Button type="submit" variant="tonal" icon={<IconPlus />} loading={pending}>
        Adicionar etapa
      </Button>
    </form>
  );
}

/**
 * Montagem da trilha: etapas e conteúdos reordenáveis (mouse ou teclado), obrigatoriedade
 * e regra de conclusão por item. Cada alteração é salva na hora e validada no servidor.
 */
export function TrackBuilder({
  trackId,
  modules: initial,
  addable,
}: {
  trackId: string;
  modules: BuilderModule[];
  addable: Addable[];
}) {
  const router = useRouter();
  const [modules, setModules] = useState(initial);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function persist(next: BuilderModule[]) {
    const previous = modules;
    setModules(next);
    const result = await reorderTrackAction(
      trackId,
      next.map((m) => ({ moduleId: m.id, itemIds: m.items.map((i) => i.id) })),
    );
    if (!result.ok) {
      setModules(previous);
      toast(result.message ?? "Não foi possível salvar a ordem.", "danger");
    }
    router.refresh();
  }

  function onModulesDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = modules.findIndex((m) => m.id === e.active.id);
    const to = modules.findIndex((m) => m.id === e.over!.id);
    if (from < 0 || to < 0) return;
    persist(arrayMove(modules, from, to));
  }

  function onItemsDragEnd(moduleId: string, e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    persist(
      modules.map((m) => {
        if (m.id !== moduleId) return m;
        const from = m.items.findIndex((i) => i.id === e.active.id);
        const to = m.items.findIndex((i) => i.id === e.over!.id);
        return from < 0 || to < 0 ? m : { ...m, items: arrayMove(m.items, from, to) };
      }),
    );
  }

  function moveItem(itemId: string, targetModuleId: string) {
    const item = modules.flatMap((m) => m.items).find((i) => i.id === itemId);
    if (!item) return;
    persist(
      modules.map((m) =>
        m.id === targetModuleId
          ? { ...m, items: [...m.items.filter((i) => i.id !== itemId), item] }
          : { ...m, items: m.items.filter((i) => i.id !== itemId) },
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-ink-muted">
        Arraste pela alça (<IconGripVertical className="inline size-4" aria-label="alça" />) para reordenar etapas e
        conteúdos. Pelo teclado: Tab até a alça, Espaço para pegar, setas para mover, Espaço para soltar.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onModulesDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {modules.map((m, index) => (
            <Sortable key={m.id} id={m.id}>
              {(handle) => (
                <Card className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {handle}
                    <div className="min-w-0 flex-1">
                      <p className="text-small font-medium tracking-[0.2px] text-ink-muted uppercase">Etapa {index + 1}</p>
                      <p className="text-h6 font-medium text-ink">{m.title}</p>
                      {m.description && <p className="text-small text-ink-soft">{m.description}</p>}
                    </div>
                    <AddContentDialog trackId={trackId} moduleId={m.id} addable={addable} />
                    <ModuleDialog trackId={trackId} module={m} />
                    {m.items.length === 0 && modules.length > 1 && (
                      <ConfirmActionButton
                        action={deleteModuleAction.bind(null, trackId, m.id)}
                        label="Excluir"
                        icon={<IconTrash />}
                        variant="ghost"
                        size="sm"
                        title="Excluir etapa?"
                        description={`A etapa “${m.title}” está vazia e será removida.`}
                        confirmLabel="Excluir"
                        confirmVariant="danger"
                        successMessage="Etapa excluída."
                      />
                    )}
                  </div>
                  {m.items.length === 0 ? (
                    <p className="border-t border-line px-4 py-4 text-small text-ink-muted">
                      Nenhum conteúdo nesta etapa. Use “Adicionar conteúdo”.
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => onItemsDragEnd(m.id, e)}
                    >
                      <SortableContext items={m.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        {m.items.map((item) => (
                          <Sortable key={item.id} id={item.id}>
                            {(itemHandle) => (
                              <ItemRow
                                trackId={trackId}
                                item={item}
                                handle={itemHandle}
                                modules={modules}
                                currentModuleId={m.id}
                                onMove={moveItem}
                              />
                            )}
                          </Sortable>
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </Card>
              )}
            </Sortable>
          ))}
        </SortableContext>
      </DndContext>
      <Card className="p-4">
        <NewModuleForm trackId={trackId} />
      </Card>
    </div>
  );
}
