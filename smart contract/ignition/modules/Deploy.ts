import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BugForgeEscrowModule = buildModule("BugForgeEscrowModule", (m) => {
  const bugForgeEscrow = m.contract("BugForgeEscrow");
  return { bugForgeEscrow };
});

export default BugForgeEscrowModule;