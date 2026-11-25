import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Chequeo optimista: si no hay cookie de sesión, manda al login.
 * La validación real (sesión vigente, usuario activo, permisos) se hace en el
 * servidor en cada página y acción (src/servidor/sesion.ts).
 */
export function proxy(request: NextRequest) {
  // La pantalla de inicio (/) es pública.
  if (request.nextUrl.pathname === "/") return NextResponse.next();
  if (!getSessionCookie(request)) {
    const url = new URL("/ingresar", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Todo menos: login/recuperación, API de auth, estáticos.
  matcher: ["/((?!ingresar|recuperar|restablecer|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp|woff2)$).*)"],
};
