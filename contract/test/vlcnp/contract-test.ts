import { ethers, waffle } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { expect } = require("chai");
const provider = waffle.provider;
import {
  test_config,
  assertPublicMintSuccess,
  assertPreMint,
} from "./test-helpers";
//@ts-ignore
import type { KawaiiMetaCollage } from "../typechain-types";
import type { BigNumber } from "ethers";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

describe(`${test_config.contract_name} contract`, function () {
  let owner: SignerWithAddress;
  let bob: SignerWithAddress;
  let alis: SignerWithAddress;
  let ad: KawaiiMetaCollage;
  let addrs;

  const not_revealed_uri = "not_revealed_uri";

  beforeEach(async function () {
    // @ts-ignore
    [owner, bob, alis, ...addrs] = await ethers.getSigners();
    const contract = await ethers.getContractFactory(test_config.contract_name);
    ad = (await contract.deploy(
      test_config.contract_name,
      test_config.symbol,
      not_revealed_uri
    )) as KawaiiMetaCollage;
    await ad.deployed();

    // Ensure contract is paused/disabled on deployment
    expect(await ad.presale()).to.equal(true);
    expect(await ad.revealed()).to.equal(false);
  });

  describe("Basic checks", function () {
    it("check the owner", async function () {
      expect(await ad.owner()).to.equal(owner.address);
    });

    it("check default is PreSale", async function () {
      expect(await ad.presale()).to.equal(true);
    });

    it("Confirm pre price", async function () {
      const cost = ethers.utils.parseUnits(test_config.price_pre.toString());
      expect(await ad.getCurrentCost()).to.equal(cost);
    });

    it("Confirm public price", async function () {
      const cost = ethers.utils.parseUnits(test_config.price.toString());
      await ad.setPresale(false);
      expect(await ad.getCurrentCost()).to.equal(cost);
    });
  });

  describe("Public Minting checks", function () {
    beforeEach(async function () {
      await ad.setPresale(false);
    });

    it("PublicMint fail if presale is active", async () => {
      const degenCost = await ad.getCurrentCost();
      await ad.setPresale(true);
      await expect(
        ad.connect(bob).publicMint(1, { value: degenCost })
      ).to.revertedWith("Public mint is paused while Presale is active.");
    });

    it("Non-owner cannot mint without enough balance", async () => {
      const degenCost = await ad.getCurrentCost();
      await expect(ad.connect(bob).publicMint(1, { value: degenCost.sub(1) }))
        .to.be.reverted;
    });

    it("Owner and Bob mint", async () => {
      const degenCost = await ad.getCurrentCost();
      let tokenId = await ad.totalSupply();
      expect(await ad.totalSupply()).to.equal(0);
      expect(
        await ad.publicMint(1, {
          value: degenCost,
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, tokenId.add(1));

      expect(await ad.totalSupply()).to.equal(1);
      tokenId = await ad.totalSupply();
      expect(
        await ad.connect(bob).publicMint(1, {
          value: degenCost,
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(ethers.constants.AddressZero, bob.address, tokenId.add("1"));

      expect(await ad.totalSupply()).to.equal(2);
    });

    it("Minting tokens increased contract balance", async () => {
      const degenCost = await ad.getCurrentCost();

      // Mint first token and expect a balance increase
      expect(await ad.publicMint(1, { value: degenCost })).to.be.ok;
      expect(await provider.getBalance(ad.address)).to.equal(degenCost);

      // Mint two additonal tokens and expect increase again
      expect(await ad.publicMint(2, { value: degenCost.mul(2) })).to.be.ok;
      expect(await provider.getBalance(ad.address)).to.equal(degenCost.mul(3));
    });

    it("Bob mints " + test_config.max_mint, async () => {
      const degenCost = await ad.getCurrentCost();
      const tokenId = await ad.totalSupply();

      expect(
        await ad.connect(bob).publicMint(test_config.max_mint, {
          value: degenCost.mul(test_config.max_mint),
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(
          ethers.constants.AddressZero,
          bob.address,
          tokenId.add(test_config.max_mint.toString())
        );
      expect(await ad.totalSupply()).to.equal(test_config.max_mint);
    });

    it("Bob mints 1 plus " + (test_config.max_mint - 1), async () => {
      const degenCost = await ad.getCurrentCost();
      const tokenId = await ad.totalSupply();

      expect(
        await ad.connect(bob).publicMint(1, {
          value: degenCost.mul(1),
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(ethers.constants.AddressZero, bob.address, tokenId.add("1"));
      expect(await ad.totalSupply()).to.equal(1);

      expect(
        await ad.connect(bob).publicMint(test_config.max_mint - 1, {
          value: degenCost.mul(test_config.max_mint - 1),
        })
      )
        .to.emit(ad, "Transfer")
        .withArgs(
          ethers.constants.AddressZero,
          bob.address,
          tokenId.add((test_config.max_mint - 1).toString())
        );
      expect(await ad.totalSupply()).to.equal(test_config.max_mint);
    });

    it("Bob fails to mints " + (test_config.max_mint + 1), async () => {
      const degenCost = await ad.getCurrentCost();

      await expect(
        ad.connect(bob).publicMint(test_config.max_mint + 1, {
          value: degenCost.mul(test_config.max_mint + 1),
        })
      ).to.revertedWith("Mint amount cannot exceed 10 per Tx.");
    });

    it("Bob fails to mints 2 with funds for 1", async () => {
      const degenCost = await ad.getCurrentCost();

      await expect(
        ad.connect(bob).publicMint(2, { value: degenCost })
      ).to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(0);
    });

    it("Public Sale Price Boundary Check", async () => {
      const cost = ethers.utils.parseUnits(test_config.price.toString());
      await assertPublicMintSuccess(ad, cost, bob, 1);
      await assertPublicMintSuccess(ad, cost.add(1), bob, 1, 1);
      await expect(
        ad.connect(bob).publicMint(1, { value: cost.sub(1) })
      ).to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(2);
    });

    it("Public Sale Price Change Check", async () => {
      const cost = ethers.utils.parseUnits("0.001");
      expect(await ad.setPublicCost(cost));
      await assertPublicMintSuccess(ad, cost, bob, 1);
      await assertPublicMintSuccess(ad, cost.add(1), bob, 1, 1);
      await expect(
        ad.connect(bob).publicMint(1, { value: cost.sub(1) })
      ).to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(2);
    });

    it(`${test_config.max_mint} mint Public Sale Price Boundary Check`, async () => {
      const cost = ethers.utils.parseUnits(test_config.price.toString());
      await assertPublicMintSuccess(
        ad,
        cost.mul(test_config.max_mint),
        bob,
        test_config.max_mint
      );
      await assertPublicMintSuccess(
        ad,
        cost.mul(test_config.max_mint).add(1),
        bob,
        1,
        test_config.max_mint
      );
      await expect(
        ad.connect(bob).publicMint(test_config.max_mint, {
          value: cost.mul(test_config.max_mint).sub(1),
        })
      ).to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(11);
    });

    it("Pre Sale price can not buy", async () => {
      const cost = ethers.utils.parseUnits(test_config.price_pre.toString());
      await expect(
        ad.connect(bob).publicMint(1, { value: cost.sub(1) })
      ).to.revertedWith("Not enough funds provided for mint");
    });

    it("Public sale have no wallet restriction (only TX)", async () => {
      const cost = await ad.getCurrentCost();
      await assertPublicMintSuccess(
        ad,
        cost.mul(test_config.max_mint),
        bob,
        test_config.max_mint
      );
      await assertPublicMintSuccess(
        ad,
        cost.mul(test_config.max_mint),
        bob,
        test_config.max_mint,
        test_config.max_mint
      );
    });
  });

  describe("URI checks", function () {
    beforeEach(async function () {
      await ad.setPresale(false);
    });

    it("Token URI not available for non-minted token", async function () {
      await expect(ad.tokenURI(1)).to.be.reverted;
    });

    it("URI not visible before reveal", async function () {
      const degenCost = await ad.getCurrentCost();
      expect(await ad.publicMint(1, { value: degenCost })).to.be.ok;
      expect(await ad.tokenURI(1)).to.equal(not_revealed_uri);
    });

    it("URI visible after reveal", async function () {
      expect(ad.reveal()).to.be.ok;

      const degenCost = await ad.getCurrentCost();
      expect(await ad.publicMint(5, { value: degenCost.mul(5) })).to.be.ok;

      const baseUri = "baseUri/";

      expect(await ad.setBaseURI(baseUri)).to.be.ok;

      const index = 3;
      expect(await ad.tokenURI(3)).to.equal(
        baseUri + index.toString() + ".json"
      );
    });
  });

  describe("Whitelist checks", function () {
    let rootTree: any;
    let hexProofs: any[];
    let mintCost: BigNumber;
    interface wlSetting {
      sign: SignerWithAddress,
      address: string,
      presaleMax: number
    }
    let leavesSettings: Array<wlSetting>;
    let proofSettings: Array<wlSetting>;
    beforeEach(async function () {
     leavesSettings = [
       {
          sign: alis,
          address: alis.address,
          presaleMax: 5
        },
      ]
      proofSettings = [
        {
          sign: owner,
          address: owner.address,
          presaleMax: 5
        },
        {
          sign: bob,
          address: bob.address,
          presaleMax: 5
        },
        {
          sign: alis,
          address: alis.address,
          presaleMax: 5
        },
      ]
      mintCost = await ad.getCurrentCost();
      const leaves = leavesSettings.map((x) => ethers.utils.solidityKeccak256(['address','uint256'],[x.address,x.presaleMax]));
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      rootTree = tree.getRoot();
      await ad.setMerkleRoot(rootTree);
      hexProofs = proofSettings.map((x) =>
        tree.getHexProof(ethers.utils.solidityKeccak256(['address','uint256'],[x.address,x.presaleMax]))
      );
    });
    it("Non Whitelisted user cant buy on PreSale", async function () {
      await expect(
        ad.connect(proofSettings[1].sign).preMint(1, proofSettings[1].presaleMax, hexProofs[1], {
          value: mintCost,
        })
      ).to.be.revertedWith("Invalid Merkle Proof");

      await expect(
        ad.connect(proofSettings[0].sign).preMint(1, proofSettings[1].presaleMax, hexProofs[0], {
          value: mintCost,
        })
      ).to.be.revertedWith("Invalid Merkle Proof");

      await assertPreMint(ad, mintCost, proofSettings[2].sign, hexProofs[2], 1, proofSettings[2].presaleMax);
    });

    it("Presale can't open on PublicSale", async function () {
      const degenCost = await ad.getCurrentCost();
      await ad.setPresale(false);
      await expect(
        ad.connect(proofSettings[1].sign).preMint(1, proofSettings[1].presaleMax, hexProofs[2], { value: mintCost })
      ).to.be.revertedWith("Presale is not active.");
    });

    it("Whitelisted multi user set", async function () {
      leavesSettings = [
        {
          sign: owner,
          address: owner.address,
          presaleMax: 5
        },
        {
          sign: bob,
          address: bob.address,
          presaleMax: 5
        },
        {
          sign: alis,
          address: alis.address,
          presaleMax: 5
        },
      ]
      proofSettings = [
        {
          sign: owner,
          address: owner.address,
          presaleMax: 5
        },
        {
          sign: bob,
          address: bob.address,
          presaleMax: 5
        },
        {
          sign: alis,
          address: alis.address,
          presaleMax: 5
        },
      ]
      const leaves = leavesSettings.map((x) =>
        ethers.utils.solidityKeccak256(['address','uint256'],[x.address,x.presaleMax])
      );
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      rootTree = tree.getRoot();
      await ad.setMerkleRoot(rootTree);
      hexProofs = proofSettings.map((x) =>
        tree.getHexProof(ethers.utils.solidityKeccak256(['address','uint256'],[x.address,x.presaleMax]))
      );
      await assertPreMint(ad, mintCost, proofSettings[0].sign, hexProofs[0], 1, proofSettings[0].presaleMax);
      await assertPreMint(ad, mintCost, proofSettings[1].sign, hexProofs[1], 1, proofSettings[1].presaleMax, 1);
      await assertPreMint(ad, mintCost, proofSettings[2].sign, hexProofs[2], 1, proofSettings[2].presaleMax, 2);
    });

    it(`Whitelisted user can only buy {presaleMax} nft`, async function () {
      mintCost = (await ad.getCurrentCost()).mul(5);

      await assertPreMint(ad, mintCost, proofSettings[2].sign, hexProofs[2], 5, proofSettings[2].presaleMax);
      await expect(
        ad.connect(proofSettings[2].sign).preMint(1, proofSettings[2].presaleMax, hexProofs[2], { value: mintCost })
      ).to.be.revertedWith("Address already claimed max amount");
    });

    it("Whitelisted user can buy 3 + 2", async function () {
      mintCost = (await ad.getCurrentCost()).mul(3);
      await assertPreMint(ad, mintCost, proofSettings[2].sign, hexProofs[2], 3, proofSettings[2].presaleMax);
      mintCost = (await ad.getCurrentCost()).mul(2);
      await assertPreMint(ad, mintCost, proofSettings[2].sign, hexProofs[2], 2, proofSettings[2].presaleMax, 3);
      mintCost = (await ad.getCurrentCost()).mul(proofSettings[2].presaleMax);
      await expect(
        ad.connect(proofSettings[2].sign).preMint(1, proofSettings[2].presaleMax, hexProofs[2], { value: mintCost })
      ).to.be.revertedWith("Address already claimed max amount");
    });

    it("Whitelisted user can not buy over WL", async function () {
      const amount = test_config.presale_max_mint + 1;
      const cost = (await ad.getCurrentCost()).mul(amount);
      await expect(
        ad.connect(proofSettings[2].sign).preMint(amount, proofSettings[2].presaleMax, hexProofs[2], { value: cost })
      ).to.be.revertedWith("Address already claimed max amount");
    });

    it("Non WhiteList user block after Whitelisted user buy", async function () {
      const amount = test_config.presale_max_mint;
      mintCost = (await ad.getCurrentCost()).mul(test_config.presale_max_mint);
      await assertPreMint(ad, mintCost, proofSettings[2].sign, hexProofs[2], amount, proofSettings[2].presaleMax);
      await expect(
        ad.connect(proofSettings[2].sign).preMint(1, proofSettings[2].presaleMax, hexProofs[2], { value: mintCost })
      ).to.be.revertedWith("Address already claimed max amount");
      await expect(
        ad.connect(proofSettings[1].sign).preMint(1, proofSettings[2].presaleMax, hexProofs[1], { value: mintCost })
      ).to.be.revertedWith("Invalid Merkle Proof");
    });

    it("Pre Sale Price Boundary Check", async () => {
      const cost = ethers.utils.parseUnits(test_config.price_pre.toString());
      await assertPreMint(ad, cost, proofSettings[2].sign, hexProofs[2], 1, proofSettings[2].presaleMax);
      await assertPreMint(ad, cost.add(1), proofSettings[2].sign, hexProofs[2], 1, proofSettings[2].presaleMax, 1);
      await expect(
        ad.connect(proofSettings[2].sign).preMint(1, proofSettings[2].presaleMax, hexProofs[2], { value: cost.sub(1) })
      ).to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(2);
    });

    it("Pre Sale setPrice Check", async () => {
      const cost = ethers.utils.parseUnits("0.001");
      expect(await ad.setPreCost(cost));
      await assertPreMint(ad, cost, proofSettings[2].sign, hexProofs[2], 1, proofSettings[2].presaleMax);
      await assertPreMint(ad, cost.add(1), proofSettings[2].sign, hexProofs[2], 1, proofSettings[2].presaleMax, 1);
      await expect(
        ad.connect(proofSettings[2].sign).preMint(1, proofSettings[2].presaleMax, hexProofs[2], { value: cost.sub(1) })
      ).to.revertedWith("Not enough funds provided for mint");

      expect(await ad.totalSupply()).to.equal(2);
    });

    it("Block over allocate Check", async () => {
      await assertPreMint(ad, mintCost.mul(5), proofSettings[2].sign, hexProofs[2], 5, proofSettings[2].presaleMax);
      expect(
        await ad
          .connect(proofSettings[2].sign)
          ["safeTransferFrom(address,address,uint256)"](
            proofSettings[2].sign.address,
            proofSettings[1].sign.address,
            1
          )
      ).to.be.ok;
      expect(await ad["balanceOf"](proofSettings[1].sign.address)).to.equal(1);
      expect(await ad["balanceOf"](proofSettings[2].sign.address)).to.equal(4);
      await expect(
        ad.connect(proofSettings[2].sign).preMint(1, proofSettings[2].presaleMax, hexProofs[2], { value: mintCost })
      ).to.be.revertedWith("Address already claimed max amount");
    });
  });
});
