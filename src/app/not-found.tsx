import Link from "next/link";

export default function NotFound() {
  return (
    <main className="public-shell">
      <section className="public-card centered-card">
        <p className="eyebrow">Error 404</p>
        <h1>No hem trobat aquesta pàgina</h1>
        <p>Potser l’enllaç ha caducat o el recurs ja no està disponible.</p>
        <Link className="button button-primary" href="/dashboard">
          Tornar al dashboard
        </Link>
      </section>
    </main>
  );
}
