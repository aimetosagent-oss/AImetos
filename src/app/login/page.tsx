import Image from "next/image";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (loginError) {
      if (loginError instanceof AuthError) redirect("/login?error=credentials");
      throw loginError;
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <Image className="login-logo" src="/brand/logo-web.png" alt="AImetos" width={189} height={62} priority />
        <div className="login-copy">
          <p className="eyebrow">CRM comercial</p>
          <h1 id="login-title">Benvingut de nou</h1>
          <p>Centralitza les oportunitats, els seguiments i la facturació comercial.</p>
        </div>
        {error ? <div className="alert alert-error">El correu o la contrasenya no són correctes.</div> : null}
        <form action={login} className="stack-form">
          <label>
            <span>Correu electrònic</span>
            <input name="email" type="email" autoComplete="email" required defaultValue="admin@aimetos.local" />
          </label>
          <label>
            <span>Contrasenya</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button button-primary button-full" type="submit">
            Iniciar sessió
          </button>
        </form>
        <p className="login-footnote">Accés restringit a l’equip d’AImetos.</p>
      </section>
      <aside className="login-aside" aria-hidden="true">
        <div>
          <span className="login-orbit" />
          <p>Del primer contacte al cobrament, sense perdre el fil comercial.</p>
        </div>
      </aside>
    </main>
  );
}
