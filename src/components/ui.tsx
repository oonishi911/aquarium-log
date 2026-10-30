// 画面共通の部品。スマホで押しやすいよう入力欄・ボタンは大きめにする
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base';
export const btnPrimary = 'rounded-lg bg-teal-700 px-4 py-3 font-bold text-white active:bg-teal-800 disabled:opacity-50';
export const btnSecondary = 'rounded-lg border border-teal-700 bg-white px-4 py-2 text-teal-800 active:bg-teal-50';
export const btnDanger = 'rounded-lg border border-red-600 bg-white px-4 py-2 text-red-700 active:bg-red-50';

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="mb-3 flex items-center gap-2">
      {back && (
        <button type="button" onClick={() => navigate(-1)} className="-ml-2 px-2 py-1 text-2xl text-teal-800" aria-label="戻る">
          ‹
        </button>
      )}
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      {right}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function TextInput(props: { value?: string; onChange: (v: string) => void; placeholder?: string; list?: string; required?: boolean; type?: string }) {
  const { onChange, value, type = 'text', ...rest } = props;
  return <input {...rest} type={type} className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

export function TextArea({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return <textarea className={inputClass} rows={3} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

// 数値入力。空欄は undefined として扱う
export function NumberInput({ value, onChange, placeholder, step = 'any' }: { value?: number; onChange: (v: number | undefined) => void; placeholder?: string; step?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      className={inputClass}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

export function Select<T extends string>({ value, onChange, options, empty }: { value?: T; onChange: (v: T | undefined) => void; options: Record<T, string> | [T, string][]; empty?: string }) {
  const entries = Array.isArray(options) ? options : (Object.entries(options) as [T, string][]);
  return (
    <select className={inputClass} value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {entries.map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

// 1つ選ぶボタン群（選択肢が少ないもの用。セレクトより1タップ少ない）
export function Choice<T extends string>({ value, onChange, options }: { value?: T; onChange: (v: T) => void; options: Record<T, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.entries(options) as [T, string][]).map(([k, label]) => (
        <button
          type="button"
          key={k}
          onClick={() => onChange(k)}
          className={`rounded-full border px-3 py-1.5 text-sm ${value === k ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// 複数選ぶボタン群（症状チェックなど）
export function MultiChoice({ value, onChange, options }: { value: string[]; onChange: (v: string[]) => void; options: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-amber-600 bg-amber-500 text-white' : 'border-slate-300 bg-white'}`}
          >
            {on ? '✓ ' : ''}
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Card({ children, to }: { children: ReactNode; to?: string }) {
  const cls = 'mb-2 block rounded-xl border border-slate-200 bg-white p-3 shadow-sm';
  return to ? (
    <Link to={to} className={`${cls} active:bg-slate-50`}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'amber' | 'red' }) {
  const tones = {
    gray: 'bg-slate-100 text-slate-700',
    green: 'bg-teal-100 text-teal-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-4 text-center text-sm text-slate-500">{children}</p>;

export function SaveBar({ saving, label = '保存' }: { saving: boolean; label?: string }) {
  return (
    <div className="sticky bottom-14 mt-4 bg-teal-50 py-2">
      <button type="submit" disabled={saving} className={`${btnPrimary} w-full`}>
        {saving ? '保存中…' : label}
      </button>
    </div>
  );
}
