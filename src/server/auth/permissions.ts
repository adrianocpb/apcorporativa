// Catálogo de permissões e papéis. O banco é sincronizado a partir daqui (seedBase).
// Novas fases acrescentam chaves; papéis futuros (ex.: GESTOR_CONTEUDO) recebem subconjuntos.

export const PERMISSIONS = {
  ADMIN_ACESSAR: "admin.acessar",
  USUARIOS_GERENCIAR: "usuarios.gerenciar",
  GRUPOS_GERENCIAR: "grupos.gerenciar",
  AUDITORIA_VER: "auditoria.ver",
  CONTEUDOS_GERENCIAR: "conteudos.gerenciar",
  CATEGORIAS_GERENCIAR: "categorias.gerenciar",
  TRILHAS_GERENCIAR: "trilhas.gerenciar",
  GAMIFICACAO_CONFIGURAR: "gamificacao.configurar",
  RELATORIOS_VER: "relatorios.ver",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "admin.acessar": "Acessar a área administrativa",
  "usuarios.gerenciar": "Criar, editar, ativar e desativar usuários",
  "grupos.gerenciar": "Criar e editar grupos de usuários",
  "auditoria.ver": "Consultar o registro de auditoria",
  "conteudos.gerenciar": "Criar, editar, publicar e arquivar conteúdos e enviar arquivos",
  "categorias.gerenciar": "Organizar as categorias da Central de Conhecimento",
  "trilhas.gerenciar": "Criar trilhas, atribuí-las e acompanhar o progresso",
  "gamificacao.configurar": "Configurar pontos, níveis e conquistas e ajustar pontuações",
  "relatorios.ver": "Consultar indicadores, progresso individual e exportar relatórios",
};

export const ROLE_KEYS = {
  ADMIN: "ADMIN",
  COLABORADOR: "COLABORADOR",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

export const ROLES: Record<
  RoleKey,
  { name: string; description: string; permissions: PermissionKey[] }
> = {
  ADMIN: {
    name: "Administrador",
    description: "Administra usuários, conteúdos, trilhas e relatórios.",
    permissions: Object.values(PERMISSIONS),
  },
  COLABORADOR: {
    name: "Colaborador",
    description: "Acessa trilhas atribuídas e a Central de Conhecimento.",
    permissions: [],
  },
};

export function hasPermission(
  user: { permissions: readonly string[] } | null | undefined,
  permission: PermissionKey,
): boolean {
  return !!user && user.permissions.includes(permission);
}
