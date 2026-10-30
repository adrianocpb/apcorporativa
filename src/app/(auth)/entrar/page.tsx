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
      <h1 className="text-h4 font-medium text-ink">Entre na sua conta</h1>
      <p className="mb-6 text-body text-ink-muted">Use seu e-mail corporativo.</p>
      <LoginForm next={typeof next === "string" ? next : ""} />
    </>
  );
}
