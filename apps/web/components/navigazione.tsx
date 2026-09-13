'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const VOCI = [
  { href: '/', label: 'Segnalazioni' },
  { href: '/blog', label: 'Approfondimenti' },
  { href: '/numeri', label: 'I numeri' },
  { href: '/norme', label: 'Norme' },
  { href: '/corte', label: 'Consulta' },
  { href: '/assistente', label: 'Assistente' },
  { href: '/come-funziona', label: 'Come funziona' },
  { href: '/dati', label: 'Dati' },
] as const;

/**
 * Navigazione principale.
 *
 * `aria-current="page"` è l'unica indicazione della pagina corrente che uno
 * screen reader riceve: il grassetto e il sottolineato servono a chi vede, e da
 * soli non bastano.
 */
export function Navigazione() {
  const pathname = usePathname();
  return (
    <nav className="navigazione" aria-label="Navigazione principale">
      <ul>
        {VOCI.map((voce) => {
          const attiva = voce.href === '/' ? pathname === '/' : pathname.startsWith(voce.href);
          return (
            <li key={voce.href}>
              <Link href={voce.href} {...(attiva ? { 'aria-current': 'page' as const } : {})}>
                {voce.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
