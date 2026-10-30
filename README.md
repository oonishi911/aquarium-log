# aquarium-log

淡水水槽の熱帯魚・水草・水質を記録するスマホ向けWebアプリ（PWA）です。

- データはすべて **スマホの中（IndexedDB）にだけ保存** され、サーバーには送られません
- 電波がなくても使えます。ホーム画面に追加するとアプリのように起動できます
- 運用費は0円（GitHub Pages で配信）

## 使い方

1. スマホのブラウザで公開URL（`https://oonishi911.github.io/aquarium-log/`）を開く
2. iPhone は Safari の共有ボタン →「ホーム画面に追加」、Android は Chrome のメニュー →「ホーム画面に追加」

### バックアップの注意
記録はそのスマホのブラウザ内にしかありません。**ブラウザのデータ削除や機種変更で消えます。** 設定画面からバックアップを定期的に書き出してください（書き出し機能はステップ3で実装予定）。

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
