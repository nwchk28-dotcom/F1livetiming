# PITWALL // F1 Live Timing

無料データで予選、決勝、暫定チャンピオンシップを表示する非公式F1ダッシュボードです。

## ローカル確認

```bash
npm install
npm run dev
```

表示された `http://localhost:5173/` をブラウザーで開いてください。

- `LIVE`: F1 Live TimingのSignalR配信へ接続中
- `CONNECTING`: ライブ配信へ接続を試行中
- `STANDBY`: 現在は予選・決勝が行われておらず、次回予選日程を表示中
- `REPLAY`: 決勝中の予選タブでQ3終了時の実アーカイブを表示中
- `OFFLINE`: 外部データを取得できず、最後の実データまたは待機画面を表示中

固定デモデータは使用しません。ライブ配信はF1が公式サイト内部で利用している未公開仕様のため、予告なく変更される可能性があります。日程と年間順位はJolpica F1 APIを利用します。

## 検証

```bash
npm test
npm run build
npm run preview
```

`npm run build` の生成物はGitHub Pagesの `/F1livetiming/` をベースパスとして出力されます。

## 実セッション確認チェックリスト

- LIVE表示に切り替わり、更新時刻が動く
- Q1/Q2/Q3、残り時間、旗状態が実際のセッションと一致する
- TimingDataの部分更新後も既存ドライバー行が消えない
- 切断後に再接続し、失敗中はREPLAY表示になる
- 決勝のLapCount、SC/VSC/赤旗が反映される

このサイトはFormula 1各社とは関係のない、個人・非商用のファンプロジェクトです。
