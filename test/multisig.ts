import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe("Multisig", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployToken() {

    const Token = await hre.ethers.getContractFactory("Token");
    const token = await Token.deploy();

    return { token };
  }

  async function deployMultisig() {
    const [owner, signer1, signer2, signer3, recipient] = await hre.ethers.getSigners();
    const quorum = 2;

    const { token } = await loadFixture(deployToken);

    const Multisig = await hre.ethers.getContractFactory("Multisig");
    const multisig = await Multisig.deploy(quorum, [signer1.address, signer2.address]);

    return { multisig, quorum, owner, signer1, signer2, signer3, token, recipient };
  }

  describe("Deployment", function () {
    it("Should fail to deploy if not enough valid signers are provided", async function () {
      const quorum = 2;
      const Multisig = await hre.ethers.getContractFactory("Multisig");
    
      // Expect deployment to fail when passing an empty array of signers
      await expect(Multisig.deploy(quorum, [])).to.be.revertedWith('few valid signers');
    });    

    it("Should fail to deploy if quorum is less than 2", async function () {
      const quorum = 1;
      const [signer1, signer2] = await hre.ethers.getSigners();
      const Multisig = await hre.ethers.getContractFactory("Multisig");
    
      // Expect deployment to fail when passing an empty array of signers
      await expect(Multisig.deploy(quorum, [signer1.address, signer2.address])).to.be.revertedWith('quorum is too small');
    });
    
    it("Should fail to deploy if quorum is greater than number of valid signers", async function () {
      const quorum = 4;
      const { multisig, signer1, signer2 } = await loadFixture(deployMultisig);
      const Multisig = await hre.ethers.getContractFactory("Multisig");

      // const aa = await Multisig.deploy(quorum, [signer1.address, signer2.address]);
      
      await expect(Multisig.deploy(quorum, [signer1.address, signer2.address])).to.be.revertedWith("quorum greater than valid signers");
    });
  });

  describe("Transfer", function () {
    it("Should fail to transfer if signer's address is not valid", async function () {
      const { multisig, signer1, signer2, signer3, token } = await loadFixture(deployMultisig);
      const amount = ethers.parseUnits("10", 18);

      await expect(multisig.connect(signer3).transfer(amount, signer3.address, token)).to.be.revertedWith("invalid signer");
    });

    it("Should revert on zero deposit", async function () {
      const { multisig, signer1, token } = await loadFixture(deployMultisig);

      const amount = ethers.parseUnits("0", 18);

      await expect(multisig.connect(signer1).transfer(amount, signer1.address, token)).to.be.revertedWith("can't send zero amount");
    });

    it("Should revert if contract balance is less than the amount to be transferred", async function () {
      const { multisig, signer1, token } = await loadFixture(deployMultisig);

      const amount = ethers.parseUnits("10", 18);

      await expect(multisig.connect(signer1).transfer(amount, signer1.address, token)).to.be.revertedWith("insufficient funds");
    });

    it("Should check if transaction id is increasing", async function () {
      const { multisig, signer1, token } = await loadFixture(deployMultisig);
  
      const amount = ethers.parseUnits("10", 18);
      const tokenAmount = ethers.parseUnits("30", 18);
  
      // Transfer tokens to signer1
      await token.transfer(signer1.address, tokenAmount);
      expect(await token.balanceOf(signer1.address)).to.equal(tokenAmount);
  
      // Approve the multisig contract to spend tokens from signer1
      await token.connect(signer1).approve(multisig, amount);
  
      // Transfer tokens from signer1 to the multisig contract
      await token.connect(signer1).transfer(multisig, tokenAmount);
      expect(await token.balanceOf(multisig)).to.equal(tokenAmount);
  
      // Call the transfer function in the multisig contract
      await multisig.connect(signer1).transfer(amount, signer1.address, token);
  
      // Check that the transaction ID is correctly incremented
      const tx = await multisig.transactions(1);
      expect(tx.id).to.equal(1);
    });
  });

  describe("Approve Transaction", function () {
    it("Should check for invalid transaction id", async function () {
      const { multisig, signer1, signer2 , token} = await loadFixture(deployMultisig);
      
      const amount = ethers.parseUnits("10", 18);
      const tokenAmount = ethers.parseUnits("30", 18);
  
      await token.transfer(signer1.address, tokenAmount);
      expect(await token.balanceOf(signer1.address)).to.equal(tokenAmount);
  
      await token.connect(signer1).approve(multisig, amount);
      await token.connect(signer1).transfer(multisig, tokenAmount);
      expect(await token.balanceOf(multisig)).to.equal(tokenAmount);
  
      await multisig.connect(signer1).transfer(amount, signer1.address, token);
      
      const id = 3;  // An id greater than txCount (should be 1 after the transfer)
  
      await expect(multisig.connect(signer1).approveTx(id)).to.be.revertedWith("invalid tx id");
    });
  });

  describe("Update Quorum", function () {
    it("Should fail to initiate quorum change if signer's address is not valid", async function () {
      const quorum = 5;
      const { multisig, signer1, signer2, signer3, token } = await loadFixture(deployMultisig);
      // const amount = ethers.parseUnits("10", 18);

      await expect(multisig.connect(signer3).updateQuorum(quorum)).to.be.revertedWith("invalid signer");
    });

    it("Should fail to initiate quorum change if the quorum is greater than valid signers", async function () {
      const quorum = 5;
      const { multisig, signer1, signer2, signer3, token } = await loadFixture(deployMultisig);
      // const amount = ethers.parseUnits("10", 18);

      await expect(multisig.connect(signer1).updateQuorum(quorum)).to.be.revertedWith("quorum greater than valid signers");
    });

    it("Should fail to initiate quorum change if the address has already requested change request", async function () {
      const quorum = 3;
      const { multisig, signer1, signer2, signer3, token } = await loadFixture(deployMultisig);
      // const amount = ethers.parseUnits("10", 18);

      // await expect(multisig.connect(signer1).updateQuorum(quorum)).to.be.revertedWith("quorum greater than valid signers");
      await multisig.connect(signer1).updateQuorum(quorum);

      await expect(multisig.connect(signer1).updateQuorum(quorum)).to.be.revertedWith("quorum change already requested");
    });

    it("Should set quorumChangeRequested value to true", async function () {
      const quorum = 3;
      const { multisig, signer1, signer2, signer3, token } = await loadFixture(deployMultisig);
      // const amount = ethers.parseUnits("10", 18);

      // await expect(multisig.connect(signer1).updateQuorum(quorum)).to.be.revertedWith("quorum greater than valid signers");
      await multisig.connect(signer1).updateQuorum(quorum);

      expect(await multisig.quorumChangeRequested()).to.be.true;
    });

    it("Should set quorum value to the new quorum value", async function () {
      const quorum = 3;
      const { multisig, signer1, signer2, signer3, token } = await loadFixture(deployMultisig);
      // const amount = ethers.parseUnits("10", 18);

      // await expect(multisig.connect(signer1).updateQuorum(quorum)).to.be.revertedWith("quorum greater than valid signers");
      await multisig.connect(signer1).updateQuorum(quorum);

      expect((await multisig.pendingQuorumChange()).newQuorum).to.be.equal(quorum);
    });

    it("Should set the number of approvals to one", async function () {
      const quorum = 3;
      const { multisig, signer1, signer2, signer3, token } = await loadFixture(deployMultisig);
      // const amount = ethers.parseUnits("10", 18);
      // await expect(multisig.connect(signer1).updateQuorum(quorum)).to.be.revertedWith("quorum greater than valid signers");
      await multisig.connect(signer1).updateQuorum(quorum);

      expect((await multisig.pendingQuorumChange()).approvals).to.be.equal(1);
    });

    // it("Should set the value of approvers at the address to", async function () {
    //   const quorum = 3;
    //   const { multisig, signer1} = await loadFixture(deployMultisig);
    //   // const amount = ethers.parseUnits("10", 18);
    //   // await expect(multisig.connect(signer1).updateQuorum(quorum)).to.be.revertedWith("quorum greater than valid signers");
    //   await multisig.connect(signer1).updateQuorum(quorum);

    //   expect((await multisig.approvers()).to.be.true;
    // });
  });
});
