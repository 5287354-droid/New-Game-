# 開発の始め方(オーナー向け)

## 1. 置き場所を用意する(おすすめ: 新しいリポジトリ)

ミチクサ鉄道の CLAUDE.md や部隊の定義と混ざらないように、**新しいリポジトリ**で作るのがおすすめです。

1. GitHub で空のリポジトリを作る(例: `diorama-mamono`)
2. Claude Code でそのリポジトリを選び、新しいセッションを始める
3. 下の「最初に送る文」を貼りつける

> このリポジトリ(New-Game-)の中で作る場合は、最初に送る文の「キットを置く場所」を `diorama/` に変えてください。

## 2. 最初に送る文(そのまま貼りつけ)

```
新作『ジオラマ魔物記』の体験版を作ってください。

仕様書とキットは、リポジトリ 5287354-droid/New-Game- のブランチ claude/new-game-concepts-0505c7 にあります。
- docs/diorama/SPEC_DEMO.md … 体験版の仕様書
- docs/diorama/kit/CLAUDE.md … このプロジェクトの方針
- docs/diorama/kit/.claude/agents/ … 部隊の定義(12班)

最初にやること:
1. 上のリポジトリを読めるようにして(add_repo)、仕様書を docs/SPEC_DEMO.md に、kit の CLAUDE.md と .claude/agents/ をこのリポジトリのルートにコピーしてコミットする
2. 部隊の定義を読みこむため、コピーしたあとは .claude/agents/ の班を Agent ツールの subagent_type に指定して使う(読みこまれていなければ、定義ファイルの本文をプロンプトに入れて general-purpose で代わりに動かす)
3. いつもの軍隊方式で進める。あなたは総司令官として自分では量産せず、班に割りふって統合と判断をする。
   Phase 0 技術検証 → 1 作戦立案 → 2 量産 → 3 統合 → 4 検証(監査 8.5/10 以上)→ 5 納品
4. 進み具合は docs/PROGRESS.md に。確認の質問で止まらず、決めて作って、決めたことを短く報告する
5. Phase 0 が終わったら、Blender(bpy)が使えたかどうかと、試作のスクショを一度報告する
```

## 3. 途中で見るところ

| 見たいもの | ファイル |
|---|---|
| 進み具合 | `docs/PROGRESS.md` |
| 決めたこと | `docs/DECISIONS.md` |
| 画風の決まり | `docs/ART_BIBLE.md` |
| 監査の点数 | `docs/AUDIT.md` |
| 完成の報告 | `docs/REPORT.md` |
