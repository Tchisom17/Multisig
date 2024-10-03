import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TokenModule = buildModule("TokenModule", (m) => {
  const erc20 = m.contract("Token");

  return { erc20 };
});

export default TokenModule;

/* 0xdc4081DB99a810997379439F4BaBB526CE44acA4 */
