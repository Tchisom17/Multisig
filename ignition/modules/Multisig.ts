import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const quorum = 3;
const validSigners = [
  "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
  "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
  "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db",
];

const MultisigModule = buildModule("MultisigModule", (m) => {
  const erc20 = m.contract("Multisig", [quorum, validSigners]);

  return { erc20 };
});

export default MultisigModule;

/* 0x97De7547A022dd80330306EdC12501F79d2119c9
   0xf5Ae647Cf2BE2f5A2c0CA3b73527B1bc9eE61556 */