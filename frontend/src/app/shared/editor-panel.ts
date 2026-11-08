import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-editor-panel',
  template: `
    <dialog #panel [attr.aria-labelledby]="titleId()" (cancel)="cancel($event)">
      <button
        class="close-panel"
        type="button"
        aria-label="Cerrar panel"
        [disabled]="busy()"
        (click)="dismiss.emit()"
      >
        ×
      </button>
      <ng-content />
    </dialog>
  `,
  styles: `
    dialog {
      position: fixed;
      inset: 0 0 0 auto;
      margin: 0;
      width: min(100%, 540px);
      max-width: 100%;
      height: 100%;
      max-height: 100%;
      padding: clamp(20px, 4vw, 32px);
      border: 0;
      border-inline-start: 1px solid var(--line);
      border-radius: 16px 0 0 16px;
      background: var(--paper);
      color: var(--ink);
      overscroll-behavior: contain;
    }
    dialog[open] {
      animation: panel-enter 210ms ease-out both;
    }
    dialog::backdrop {
      background: rgb(14 23 17 / 58%);
    }
    .close-panel {
      position: absolute;
      inset: 12px 12px auto auto;
      width: 44px;
      padding: 0;
      font-size: 1.35rem;
    }
    @keyframes panel-enter {
      from {
        transform: translateX(100%);
      }
    }
    @keyframes panel-mobile {
      from {
        opacity: 0;
      }
    }
    @media (max-width: 799px) {
      dialog {
        width: 100%;
        border: 0;
        border-radius: 0;
        padding-bottom: max(24px, env(safe-area-inset-bottom));
      }
      dialog[open] {
        animation-name: panel-mobile;
      }
    }
  `,
})
export class EditorPanel implements OnDestroy {
  readonly titleId = input.required<string>();
  readonly busy = input(false);
  readonly trigger = input<HTMLElement>();
  readonly dismiss = output<void>();
  private readonly panel = viewChild.required<ElementRef<HTMLDialogElement>>('panel');
  private readonly document = inject(DOCUMENT);
  private dialog?: HTMLDialogElement;
  private opener?: HTMLElement;

  constructor() {
    afterNextRender(() => {
      const active = this.document.activeElement;
      this.opener = this.trigger() ?? (active instanceof HTMLElement ? active : undefined);
      this.dialog = this.panel().nativeElement;
      this.dialog.showModal();
    });
  }

  cancel(event: Event): void {
    event.preventDefault();
    if (!this.busy()) this.dismiss.emit();
  }

  ngOnDestroy(): void {
    this.dialog?.close();
    // El botón puede seguir deshabilitado hasta que termine este render.
    queueMicrotask(() => this.opener?.focus({ preventScroll: true }));
  }
}
