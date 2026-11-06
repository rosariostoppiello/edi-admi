"use client";
import { createAuthClient } from "better-auth/react";

/**
 * Cliente de auth para formularios de login y recuperación. Pasa por
 * /api/auth, así se aplican el rate limit y las protecciones de Better Auth.
 */
export const authCliente = createAuthClient();
