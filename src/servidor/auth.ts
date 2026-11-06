import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { enviarMail } from "./mail";
import { registrarAuditoria } from "./auditoria";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // No hay registro público: Administración crea los usuarios y las invitaciones.
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hora
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      const tieneClave = await db.account.count({ where: { userId: user.id, providerId: "credential" } });
      if (tieneClave === 0) {
        // Invitación: el usuario todavía no eligió contraseña. El enlace dura 7 días.
        await db.verification.updateMany({
          where: { identifier: `reset-password:${token}` },
          data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        });
        void enviarMail({
          para: user.email,
          asunto: "Tu acceso al sistema de gastos comunes",
          texto: `Hola ${user.name}:\n\nTe dieron acceso al sistema de gastos comunes del edificio. Ahí vas a ver tus liquidaciones, reservar la barbacoa y mandar solicitudes a la administración.\n\nPara entrar, creá tu contraseña en este enlace (vence en 7 días):\n${url}\n\nTu usuario es este mail: ${user.email}`,
        });
        return;
      }
      // Sin await para no revelar por tiempos si el mail existe.
      void enviarMail({
        para: user.email,
        asunto: "Cambiá tu contraseña",
        texto: `Hola ${user.name}:\n\nPara elegir una contraseña nueva entrá a este enlace (vence en 1 hora):\n${url}\n\nSi no lo pediste, ignorá este mensaje.`,
      });
    },
    onPasswordReset: async ({ user }) => {
      await registrarAuditoria({
        usuarioId: user.id,
        accion: "contrasena.restablecida",
        entidad: "user",
        entidadId: user.id,
      });
    },
  },
  user: {
    additionalFields: {
      rol: { type: "string", required: false, defaultValue: "UNIDAD", input: false },
      activo: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24, // se renueva una vez por día de uso
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 30,
    // Límites por IP. Configurables solo para poder subirlos en los tests e2e;
    // nunca se desactivan.
    customRules: {
      "/sign-in/email": { window: 60, max: Number(process.env.AUTH_MAX_INTENTOS_LOGIN ?? 5) },
      "/request-password-reset": { window: 60, max: Number(process.env.AUTH_MAX_PEDIDOS_RESET ?? 3) },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Un usuario dado de baja no puede iniciar sesión.
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { activo: true },
          });
          if (!user?.activo) return false;
          return { data: session };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
