import { useState } from 'react';
import { Card, PageHeader } from '../components/ui';

// 撮影ルール（要件 4章）。色の比較は照明で大きく変わるので、毎回同じ条件で撮る
export const photoGuideRules: [string, string][] = [
  ['照明はいつも同じ', '水槽の照明だけを点け、部屋の照明は消す。点灯から1時間以上たってから撮る'],
  ['時刻をそろえる', 'できれば毎回同じ時間帯（例: 点灯後2〜3時間）'],
  ['位置と角度をそろえる', '水槽の正面から、ガラスに垂直に。立ち位置や台に印を決めておく'],
  ['フラッシュは使わない', 'ガラスへの映り込みも避ける'],
  ['ガラス面を拭いてから撮る', 'コケや水滴で色が変わる'],
  ['カメラの自動補正を切る', 'HDR・美肌・AIシーン補正などをOFFにする'],
  ['換水・給餌の直後は避ける', '濁りや泡が写るため'],
  ['（おすすめ）白かグレーのカードを写し込む', '将来の色補正の基準になる'],
];

// その場で確認するためのチェックリスト（チェックは保存しない）
export function PhotoGuideChecklist() {
  const [checked, setChecked] = useState<number[]>([]);
  return (
    <ul>
      {photoGuideRules.map(([title, detail], i) => {
        const on = checked.includes(i);
        return (
          <li key={title} className="border-b py-2 last:border-b-0">
            <label className="flex gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-teal-700"
                checked={on}
                onChange={() => setChecked(on ? checked.filter((c) => c !== i) : [...checked, i])}
              />
              <span>
                <span className={`block font-bold ${on ? 'text-teal-800' : ''}`}>{title}</span>
                <span className="block text-sm text-slate-600">{detail}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export default function PhotoGuide() {
  return (
    <section>
      <PageHeader title="撮影ガイド" back />
      <p className="mb-3 text-sm text-slate-600">
        水草の色の変化を正しく比べるため、毎回できるだけ同じ条件で撮影してください。守れなかった回は、色変化レポートで「撮影ルールを守れた」のチェックを外すと、比較の文章に注意書きが付きます。
      </p>
      <Card>
        <PhotoGuideChecklist />
      </Card>
    </section>
  );
}
