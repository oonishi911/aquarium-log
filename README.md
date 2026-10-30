# aquarium-log

淡水水槽の熱帯魚・水草・水質を記録するスマホ向けWebアプリ（PWA）です。

- データはすべて **スマホの中（IndexedDB）にだけ保存** され、サーバーには送られません
- 電波がなくても使えます。ホーム画面に追加するとアプリのように起動できます
- 運用費は0円（GitHub Pages で配信）

## 使い方

1. スマホのブラウザで公開URL（`https://oonishi911.github.io/aquarium-log/`）を開く
2. iPhone は Safari の共有ボタン →「ホーム画面に追加」、Android は Chrome のメニュー →「ホーム画面に追加」

### バックアップの注意
記録はそのスマホのブラウザ内にしかありません。**ブラウザのデータ削除や機種変更で消えます。** 設定画面の「バックアップを書き出す」で、写真込みの JSON ファイル（`aquarium-log-backup-YYYYMMDD.json`）を定期的に保存してください。同じ画面から読み込むと、その内容に置き換わります。

## できること（最小版）

- 水槽の追加・編集（サイズから水量を自動計算、立ち上げからの日数表示）
- 生体の登録（群れ単位が基本。ペアはオス・メスを個体で登録してひもづけ）、数の増減・水槽移動の履歴
- 水草の登録
- 生体・水草の状態記録（症状チェック、体長、対処、トリミング・追肥）
- 水質記録（初期表示は水温と pH。KH・GH などは設定で表示）
- 作業記録とテンプレート（「1/3換水」などを1タップで入力）
- 写真の添付（長辺1600pxに縮小して端末内に保存）
- 記録一覧、バックアップの書き出し・読み込み

## 開発

必要なもの: Node.js 22

```sh
npm install
npm run dev            # 開発サーバー
npm test               # テスト（Vitest）
npm run build          # 本番ビルド（dist/）
npm run check-secrets  # コミット前の秘密情報チェック
```

main ブランチに push すると GitHub Actions がテスト・ビルドし、GitHub Pages に公開します。

## 技術構成

React 18 / TypeScript / Vite / vite-plugin-pwa / Dexie.js（IndexedDB）/ React Router（ハッシュ方式）/ Tailwind CSS / Vitest

## リポジトリに入れないもの

このリポジトリは公開です。APIキーなどの秘密情報、バックアップファイル、写真は `.gitignore` で除外しています。
