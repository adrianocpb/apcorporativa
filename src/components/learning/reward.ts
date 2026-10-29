"use client";

import { toast } from "@/components/ui/toaster";

export type Reward = {
  points: number;
  levelUp: { number: number; name: string } | null;
  achievements: { name: string; points: number }[];
};

/** Avisos discretos de pontos, conquistas e novo nível após uma conclusão. */
export function announceReward(reward: Reward | undefined | null) {
  if (!reward) return;
  if (reward.points > 0) toast(`+${reward.points} pontos`);
  for (const a of reward.achievements) toast(`Nova conquista: ${a.name}`);
  if (reward.levelUp) toast(`Você alcançou o nível ${reward.levelUp.number} — ${reward.levelUp.name}!`);
}
