import Link from "next/link";
import { IconoVolver } from "@/componentes/ui/iconos";

export function Volver({ href = "/", texto = "Inicio" }: { href?: string; texto?: string }) {
  return (
    <Link href={href} className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-bold hover:text-bronce">
      <IconoVolver className="size-5" />
      {texto}
    </Link>
  );
}
