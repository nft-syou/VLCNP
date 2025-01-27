# ジェネレーティブ NFT コレクションのテンプレート

このプログラムでは、ジェネレーティブ NFT コレクションに必要なツールが全て入っています。

- NFT 発行用コントラクト
- mint ページおよびコントラクトと繋ぎこみするフロントエンド
- ジェネレーティブ NFT の画像生成ツール

# 特徴

- MerkleTree 対応
- コントラクトのテストケースが一通りあり
- コントラクトテストのカバレッジ対応（予定）
- CSV データを基にした柔軟な画像生成
- フロントエンドの画面データもあり。

# QuickStart

NFTboil は monorepo で作成されています。

- contract - NFT 発行用のコントラクトを hardhat にて作成しています。
- generate - ジェネレーティブ用の画像生成をするプログラムです。
- frontend - mint 用の Web サイトです。

## Install

`npm install`
WorkSpace の設定があるため、ルートディレクトリで npm install の設定をすると全ての設定が一括インストールできます

## コントラクトの設定

NFTBoil において、コントラクトを二種類用意しています。この二つのコントラクトの違いは、
プレセールの実装に MerkleTree を利用するかどうかです。
デフォルトの設定は MerkleTree を利用するプログラムですので、もし MerkleTree を利用しない
NFT コントラクトを実装する場合は、AstarCats.sol を利用してください。

- KawaiiMetaCollage.sol (デフォルト) - MerkleTree
- AstarCats.sol - MerkleTree なし

### env ファイルの設定

コントラクトをデプロイするために必要な情報を env ファイルに書き込んでいきます。
.env.example ファイルをコピーして .env ファイルを作成して、そこの設定を書き換えてください。

`cp ~/NFTBoil/contract/.env.example ~/NFTBoil/contract/.env`

ACCOUNT_PRIVATE_KEY は、コントラクトデプロイするオペレーターのウォレットの秘密鍵です。絶対に外部に漏洩しないでください。
また、RINKEBY_RPC, MAINNET_RPC は、カスタム RPC を infula や alchemy から取得してください。
もし Ethereum 以外のプロジェクトであれば、こちらの変数は削除してかまいません。
CONTRACT_NAME, CONTRACT_SYMBOL, IPFS_JSON は自分のプロジェクトのものに変えてください。

### コントラクトのテスト

まず、ローカルにてノードを立ち上げて、コントラクトが正しく動くかを確かめてください。

`cd ~/NFTBoil/contract/`
`npx hardhat node`

もし、install の時に typechain の設定が必要であれば、下記コマンドで出来ます。
`npx hardhat typechain`

ローカルにノードを立ち上げたら、テストコードの実施をしてください。

`npx hardhat test`

テストがすべて通れば成功です。
また、プロジェクトにおいてコードを書き換えた場合は、テストコードの修正も行ったほうが良いでしょう。

### コントラクトのデプロイ

Ethereum チェーンでデプロイする前提であれば、まずはテストネットの Rinkeby Network にデプロイをします。
（他のチェーンにデプロイするときは適宜 hardhat.config.ts に network を追加してください。）
また、テストネットにアップロードする前に、事前に faucet から ETH をゲットしてください。

その後、下記コマンドでテストネットにデプロイします。

`npx hardhat run scripts/deploy.ts --network rinkeby`
デプロイした後は etherscan でデプロイしたコントラクトを確認してください。

### コントラクトの verify

信頼性担保のため、コントラクトは必ず verify しましょう。
コントラクトの verify は etherscan から行います。
また、コントラクトを verify するためには、Flat 化したソースコードが必要です。こちらのコマンドで flat 化できます。

`npm run flatten`

out/ ファイルにて生成されるコードを、etherscan の verify にて利用してください。

### mainnet へのデプロイ

mainnet へデプロイするときは下記のコマンドでできます。
Ethereum の場合、ガス代が大きくかかるのでご注意ください。
`npx hardhat run scripts/deploy.ts --network mainnet`

## ジェネレーティブ画像生成

NFTboil では、ジェネレーティブの画像を生成するプログラムも同梱されています。
CSV にてまずパーツ画像のデータを作成し、それを読み込ませて画像と JSON ファイルを作成します。
画像生成用のプログラムは generate/ ディレクトリの中にあります。

### CSV ファイルの作成

generate/metadata.csv にある例をもとにして、CSV データを作成してください。
CSV データから画像生成および JSON データを生成するため、CSV データ生成時に Excel 関数などを利用することにより
柔軟にパーツの条件を記述することが可能です。
こちらは opensea の metadata standard に準拠した形になっています。
https://docs.opensea.io/docs/metadata-standards

- id - ID 番号
- name - それぞれのトークンの名前
- description - OpenSea の詳細画面に表示する詳細です。
- external_url - 外部サイトへのリンクです。こちらは OpenSea にて外部サイトのリンクとして表示されます。
- background_color - 背景文字です。

また、パーツの画像データのレイヤーおよび metadata の attributes は、
config.json の trait にて指示することが可能です。

### config.json の編集

generate/config.json を編集してください。

### assets フォルダに画像データを格納

画像データを generate/assets/ ディレクトリの中に入れてください。
このとき、metadata のパーツ名と、画像のディレクトリ名およびファイル名が一致している必要があります。
ディレクトリ名は metadata の attribute 名と同一にして、 ファイル名は metadata のパーツ名と完全一致してください。
また、現在のところ png データのみ対応しています。

### 画像生成プログラムの起動

下記コマンドで画像生成プログラムの起動が可能です。
`npm run generate`
このプログラムは画像の大きさにより、マシンパワーが非常にかかりますので、
よりスペックの高いマシンで動かすのをオススメします。
また、最初は 100 枚ほどの単位でテスト的に生成し、クリエイターと共同で画像チェックをすることをオススメします。

### サムネイル画像の生成

こちらのコマンドにて、サムネイル画像の生成が可能です。
`npm run thumbnail`
サムネイル画像は本番では利用しませんが、クリエイターと画像データ確認をするときに利用してください。
本番データはしばしば数十ＧＢになってネットワーク容量を圧迫しますので、
サムネイル画像にすることによりファイルサイズを削減します。

### IPFS へのアップロード

IPFS へアップロードするのは IPFS node を立ち上げてアップロードするのが推奨された方式です。
詳しくはこちらの記事をご確認ください。
https://note.com/hayattiq/n/n752d51d07cda

### JSON ファイルの作成

画像ファイル生成に利用した csv ファイルを使って、そのまま JSON ファイルを作成することも可能です。

` npm run tojson`
こちらのコマンドで JSON ファイルを作成することができます。
通常のコマンドですと、CSV ファイルの順番通りに JSON ファイルを作成します。

また、Generative ファイルでは、リビール時のレア度選出の公平性向上のため、metadata をシャッフルすることが多いですが、
本プログラムを利用してシャッフルすることが可能です。
シャッフルは metashu プログラムを利用しますが、そのプログラムで利用するため、json 出力時に pack します。

```npm run tojson -- -p
npm run shuffle -- -s [[[random salt string]]]
for f in json/*; do mv "$f" "$f.json"; done
```

### JSON ファイルの IPFS へのアップ

画像ファイルをアップロードしたのと同じ方法で JSON ファイルも IPFS にアップロードしてください。

## mint web サイトの構築

NFTboil では、 mint サイト のテンプレートを用意しています。
開発者はこのテンプレートを編集することにより、mint サイトを簡単に作成することが可能です。

### frontend の編集

frontend は React を利用して構築されています。
プロジェクトごとに frontend/src を書き換えて、自分のプロジェクトとしてページ作成してください。

### config ファイルの編集

frontend/public/config/config.json に、フロントエンドにて利用する config ファイルがあります。
各プロジェクトにあわせて、それぞれの設定を書き換えてください。

### MerkleTree の実装 (Optional)

もしホワイトリストを利用したセールを実施するときのために、MerkleTree 機能も実装しています。
MerkleTree は複雑な概念のため、こちらを読んで概略を掴んでください。
https://medium.com/@ItsCuzzo/using-merkle-trees-for-nft-whitelists-523b58ada3f9

MerkleTree を実装するときは、コントラクトに MerkleRoot を入れるのと、 frontend/functions/merkletree.ts に、
MerkleTree に利用するアドレスを入れてください。

### ページのアップロード

こちらの frontend はサーバサイドプログラムを利用していないため、 Netlify などの静的サーバにアップロードすることですぐに利用可能です。
また、Netlify を使う時のため、 netlify.toml ファイルも用意しています。

こちらでページアップロードをすることで完成です！あなたのコレクションがよく売れることを願っています。

# FAQ

## なぜ ERC-721A ではなく ERC-721 なのですか

ERC-721A は、多くのプロジェクトで使われているとはいえ、 OpenZeppelin で採用されている ERC721 と違い EIP の標準ではありません。
今後永続的に NFT が残ることを考えると ERC-721 のほうがスタンダードです。
また、ERC-721A は複数 mint 時のガス代しか安くならず、 Transfer においては逆にガス代が高くなることもあります。
また、tokenOfOwnerByIndex が全ての発行済みトークンを走査するため、この関数をトランザクションの一部で実行した場合に、発行済みトークンの数だけ処理が実行されることになります。この処理は、ストレージの更新を伴わないため、1 つ 1 つは大きな gas となりませんが、膨大な数のトークンがある場合には注意が必要になったりします。

mint 時のガス代が大きな問題にならない限り、ERC721 の利用をオススメします。
