import { Component, inject, input, OnInit, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { PlannedDay } from '../../core/domain/model';
import type { DayLogistics } from '../../core/domain/planned-day';
import { dateLabel } from '../../shared/display';

@Component({
  selector: 'app-day-editor',
  imports: [ReactiveFormsModule],
  template: `
    <p class="eyebrow">{{ dateLabel(day().date, true) }}</p>
    <h2 id="day-editor-title">Editar jornada</h2>
    <p class="muted">{{ stageName() }}</p>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <fieldset [disabled]="busy()">
        <label>Dónde dormir <input type="text" formControlName="lodgingCandidate" /></label>
        <label
          >Estado de la reserva
          <input type="text" formControlName="lodgingStatusText" list="booking-status" />
          <datalist id="booking-status">
            <option value="Sin reservar"></option>
            <option value="Por confirmar"></option>
            <option value="Confirmado"></option>
          </datalist>
        </label>
        <label>Abastecimiento <textarea rows="2" formControlName="supplyNotes"></textarea></label>
        <label>Plan B <textarea rows="2" formControlName="alternativeNotes"></textarea></label>
      </fieldset>
      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        <button class="primary" type="submit" [disabled]="busy() || !form.dirty">
          {{ busy() ? 'Guardando…' : 'Guardar cambios' }}
        </button>
        <button class="text-button" type="button" [disabled]="busy()" (click)="dismiss.emit()">
          Cancelar
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block;
      padding-top: 12px;
    }
    h2 {
      font-size: clamp(1.8rem, 6vw, 2.6rem);
      margin-bottom: 0;
      padding-right: 40px;
    }
    fieldset {
      display: grid;
      gap: 14px;
      border: 0;
      padding: 0;
      margin: 22px 0 0;
      min-width: 0;
    }
    label {
      display: grid;
      gap: 5px;
      font-weight: 650;
    }
    input,
    textarea {
      width: 100%;
      background: var(--background);
      font-weight: 400;
    }
    textarea {
      resize: vertical;
    }
  `,
})
export class DayEditor implements OnInit {
  readonly day = input.required<PlannedDay>();
  readonly stageName = input.required<string>();
  readonly busy = input(false);
  readonly error = input('');
  readonly save = output<DayLogistics>();
  readonly dismiss = output<void>();
  readonly dateLabel = dateLabel;
  readonly form = inject(NonNullableFormBuilder).group({
    lodgingCandidate: '',
    lodgingStatusText: '',
    supplyNotes: '',
    alternativeNotes: '',
  });

  ngOnInit(): void {
    this.form.patchValue(this.day().logistics);
  }

  submit(): void {
    if (!this.busy() && this.form.dirty) this.save.emit(this.form.getRawValue());
  }
}
