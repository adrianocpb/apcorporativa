// Formatação pt-BR. Datas com hora usam o fuso da empresa; datas puras (ex.: data de
// entrada) são gravadas à meia-noite UTC e exibidas em UTC para não "voltar um dia".

const TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "America/Sao_Paulo";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TIME_ZONE });
const dateOnlyFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const longDateFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});
const numberFormat = new Intl.NumberFormat("pt-BR");

export function formatDateTime(date: Date | null | undefined) {
  return date ? dateTimeFormat.format(date) : "—";
}

export function formatDate(date: Date | null | undefined) {
  return date ? dateFormat.format(date) : "—";
}

export function formatDateOnly(date: Date | null | undefined) {
  return date ? dateOnlyFormat.format(date) : "—";
}

export function formatLongDate(date: Date) {
  return longDateFormat.format(date);
}

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function toDateInputValue(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function greeting(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: TIME_ZONE }).format(
      date,
    ),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
