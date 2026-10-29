import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-h5 font-medium text-ink">Entrar</h1>
      <p className="mb-6 text-body text-ink-soft">Use seu e-mail ou login corporativo.</p>
      <LoginForm next={typeof next === "string" ? next : ""} />
    </>
  );
}
