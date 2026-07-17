import Image from "next/image";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="login-page"><section className="login-card"><Image src="/brand/logo-web.png" alt="AImetos" width={186} height={54} priority /><div className="login-heading"><span className="eyebrow">Control Center</span><h1>Tot AImetos, en un sol cop d’ull.</h1><p>Accés privat a agents, leads, projectes, finances i contingut.</p></div><form action="/api/auth/login" method="post"><label htmlFor="password">Contrasenya</label><input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••••••" />{error ? <p className="form-error">La contrasenya no és correcta.</p> : null}<button type="submit">Entrar al dashboard</button></form><small>Les fonts es consulten en mode només lectura.</small></section><aside className="login-visual"><div className="orb orb-one" /><div className="orb orb-two" /><div className="login-quote"><span>“</span><p>Un dashboard només serveix si et diu què has de mirar ara.</p></div></aside></main>;
}
