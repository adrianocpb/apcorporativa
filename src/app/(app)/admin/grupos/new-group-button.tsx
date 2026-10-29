"use client";

import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { GroupForm } from "./group-form";
import { createGroupAction } from "./actions";

const toGroupPage = (data: { id: string }) => `/admin/grupos/${data.id}`;

export function NewGroupButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<IconPlus />} onClick={() => setOpen(true)}>
        Novo grupo
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Novo grupo">
        <GroupForm action={createGroupAction} submitLabel="Criar grupo" onCreatedHref={toGroupPage} />
      </Modal>
    </>
  );
}
