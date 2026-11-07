import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';

export type Destination = 'route' | 'diary' | 'copy';
type Theme = 'system' | 'light' | 'dark';
const themeKey = 'routale:theme';

@Component({
  selector: 'app-navigation',
  imports: [NgOptimizedImage],
  template: `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/" aria-label="Routale, inicio">
          <img ngSrc="routale-icon.svg" alt="" width="34" height="34" /> Routale
        </a>
        @if (destination(); as current) {
          <nav aria-label="Secciones principales">
            @for (item of items; track item.id) {
              <button
                type="button"
                [attr.aria-current]="current === item.id ? 'page' : null"
                (click)="navigate.emit(item.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="item.icon" /></svg>
                {{ item.label }}
              </button>
            }
          </nav>
        }
        <label class="appearance">
          <select aria-label="Apariencia" [value]="theme()" (change)="chooseTheme($event)">
            <option value="system">Sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
      </div>
    </header>
  `,
  styles: `
    .site-header {
      border-bottom: 1px solid var(--line);
    }
    .header-inner {
      width: min(100% - 72px, 1320px);
      margin: auto;
      min-height: 76px;
      display: flex;
      align-items: center;
      gap: 28px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--ink);
      font: 700 1.8rem/1 var(--font-display);
      letter-spacing: -0.05em;
      text-decoration: none;
      min-height: 44px;
    }
    .brand img {
      border-radius: 50%;
    }
    nav {
      display: flex;
      gap: 16px;
    }
    nav button {
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      padding-inline: 4px;
      font-weight: 650;
      color: var(--muted);
    }
    nav button[aria-current='page'] {
      border-color: var(--brand);
      color: var(--ink);
    }
    nav svg {
      display: none;
    }
    .appearance {
      margin-left: auto;
    }
    .appearance select {
      min-height: 44px;
      background: var(--paper);
      padding: 5px 8px;
    }
    @media (max-width: 799px) {
      .header-inner {
        width: calc(100% - 36px);
        min-height: 64px;
        gap: 12px;
      }
      nav {
        position: fixed;
        inset: auto 0 0;
        z-index: 2;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        padding: 3px 8px calc(3px + env(safe-area-inset-bottom));
        border-top: 1px solid var(--line);
        background: var(--paper);
      }
      nav button {
        display: grid;
        justify-items: center;
        align-content: center;
        min-height: 58px;
        gap: 3px;
        border: 0;
        border-radius: 8px;
        font-size: 0.78rem;
      }
      nav button[aria-current='page'] {
        color: var(--brand);
        font-weight: 800;
      }
      nav button:focus-visible {
        outline-offset: -3px;
      }
      nav svg {
        display: block;
        width: 22px;
        height: 22px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    }
  `,
})
export class Navigation {
  private readonly document = inject(DOCUMENT);
  readonly destination = input<Destination | null>(null);
  readonly navigate = output<Destination>();
  readonly theme = signal<Theme>('system');
  readonly items = [
    { id: 'route', label: 'Ruta', icon: 'M3 17 8 7l4 7 3-5 6 8M3 20h18' },
    {
      id: 'diary',
      label: 'Diario',
      icon: 'M12 5c-2-2-6-2-9-1v15c3-1 7-1 9 1 2-2 6-2 9-1V4c-3-1-7-1-9 1Zm0 0v15',
    },
    { id: 'copy', label: 'Mi copia', icon: 'M8 8h12v13H8zM16 5V3H4v13h1' },
  ] as const;

  constructor() {
    try {
      const saved = localStorage.getItem(themeKey);
      if (saved === 'light' || saved === 'dark') this.applyTheme(saved);
    } catch {
      // La apariencia puede seguir la del sistema con almacenamiento restringido.
    }
  }

  chooseTheme(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value !== 'light' && value !== 'dark' && value !== 'system') return;
    this.applyTheme(value);
    try {
      localStorage.setItem(themeKey, value);
    } catch {
      // El cambio sigue activo durante esta sesión.
    }
  }

  private applyTheme(theme: Theme): void {
    this.theme.set(theme);
    this.document.documentElement.dataset['theme'] = theme;
  }
}
