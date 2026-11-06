import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-grande font-bold">No encontramos esta página</h1>
      <p className="text-pizarra-suave">
        Puede que el enlace esté mal escrito o que no tengas acceso a esta sección.
      </p>
      <Link href="/" className="self-start py-2 font-bold underline underline-offset-4 hover:text-bronce">
        Volver al inicio
      </Link>
    </main>
  );
}
