import pg from "pg";
import "dotenv/config";
import { USUARIOS_RESET, VECINA } from "./utiles";

/** Consultas de solo lectura a la base de test para elegir datos de cada caso. */
async function consultar<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
  await cliente.connect();
  try {
    return (await cliente.query(sql, params)).rows as T[];
  } finally {
    await cliente.end();
  }
}

export interface UnidadDePrueba {
  unidadId: string;
  torre: number;
  numero: string;
  duenoEmail: string;
  inquilinoEmail: string | null;
}

/**
 * Devuelve la n-ésima unidad (apartamento, rol UNIDAD, sin Comisión) que cumpla
 * la condición. Cada proyecto/test usa un `n` distinto para no pisarse.
 * Se excluyen los usuarios que otros tests usan o a los que les cambian la
 * contraseña, para que el orden no dependa de qué test corrió antes.
 */
export async function unidad(arrendada: boolean, n: number): Promise<UnidadDePrueba> {
  const filas = await consultar<UnidadDePrueba>(
    `SELECT u.id AS "unidadId", u."torreId" AS torre, u.numero,
            d.email AS "duenoEmail", i.email AS "inquilinoEmail"
       FROM unidad u
       JOIN persona d ON d."unidadId" = u.id AND d.activa AND d.calidad <> 'INQUILINO'
       JOIN "user" du ON du.id = d."userId" AND du.rol = 'UNIDAD'
       LEFT JOIN persona i ON i."unidadId" = u.id AND i.activa AND i.calidad = 'INQUILINO'
      WHERE u.arrendada = $1 AND u.tipo = 'APTO'
        AND (SELECT count(*) FROM persona x WHERE x."userId" = d."userId" AND x.activa) = 1
        AND d.email <> ALL($3) AND (i.email IS NULL OR i.email <> ALL($3))
        -- Solo usuarios del seed (con contraseña), no los que crean otros tests.
        AND EXISTS (SELECT 1 FROM account a WHERE a."userId" = d."userId" AND a."providerId" = 'credential')
        AND (i.id IS NULL OR EXISTS (SELECT 1 FROM account a WHERE a."userId" = i."userId" AND a."providerId" = 'credential'))
      ORDER BY u."torreId", u.numero
      OFFSET $2 LIMIT 1`,
    [arrendada, n, [VECINA, ...Object.values(USUARIOS_RESET)]],
  );
  if (!filas[0]) throw new Error(`No hay unidad de prueba (arrendada=${arrendada}, n=${n})`);
  return filas[0];
}

export async function idDeUnidadAjena(excepto: string): Promise<string> {
  const [f] = await consultar<{ id: string }>(`SELECT id FROM unidad WHERE id <> $1 ORDER BY numero LIMIT 1`, [excepto]);
  return f.id;
}
