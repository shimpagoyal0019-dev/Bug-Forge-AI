import { ethers } from "ethers";

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS;

const ABI = [
  "function createReport(uint256 _minBounty, string memory _reportHash) external returns (uint256)",
  "function lockBounty(uint256 _id, uint256 _deadline) external payable",
  "function verifyAndRelease(uint256 _id) external",
  "function raiseDispute(uint256 _id) external",
  "function getReport(uint256 _id) external view returns (tuple(uint256 id, address hacker, address organization, uint256 amount, uint256 minBounty, uint8 status, string reportHash, uint256 createdAt, uint256 deadline))",
  "event ReportCreated(uint256 indexed id, address indexed hacker, uint256 minBounty)",
  "event BountyLocked(uint256 indexed id, address indexed organization, uint256 amount)",
  "event BountyReleased(uint256 indexed id, address indexed hacker, uint256 amount)",
];

// ── $1 = 0.000003 ETH (testnet demo rate) ──────────────────
// Makes $5000 bounty = 0.015 ETH (affordable on faucet ETH)
const USD_TO_ETH = 300_000;

export const connectWallet = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found. Please install MetaMask.");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
};

export const getSigner = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const provider = new ethers.BrowserProvider(window.ethereum);
  return provider.getSigner();
};

export const getContract = async () => {
  if (!CONTRACT_ADDRESS) throw new Error("REACT_APP_CONTRACT_ADDRESS not set in .env");
  const signer = await getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
};

export const switchToSepolia = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId:        "0xaa36a7",
          chainName:      "Sepolia Testnet",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls:        ["https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
    } else {
      throw err;
    }
  }
};

// ── Helper ────────────────────────────────────────────────
const usdToWei = (usd) => {
  const eth = (usd / USD_TO_ETH).toFixed(8);
  return ethers.parseEther(eth);
};

export const usdToEthDisplay = (usd) =>
  (usd / USD_TO_ETH).toFixed(6) + " ETH";

// ── STEP 1 — Hacker registers report on-chain ─────────────
export const createReportOnChain = async (minBountyUsd, mongoReportId) => {
  await switchToSepolia();
  const contract = await getContract();
  const minWei   = usdToWei(minBountyUsd);

  console.log(`Creating report on-chain: $${minBountyUsd} = ${ethers.formatEther(minWei)} ETH`);

  const tx      = await contract.createReport(minWei, mongoReportId);
  const receipt = await tx.wait();

  let contractReportId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "ReportCreated") {
        contractReportId = Number(parsed.args.id);
        break;
      }
    } catch {}
  }

  if (contractReportId === null) {
    throw new Error("ReportCreated event not found in tx");
  }

  console.log(`Report created on-chain with ID: ${contractReportId}`);
  return { contractReportId, txHash: tx.hash };
};

// ── STEP 2 — Org locks ETH in escrow ─────────────────────
export const lockBountyOnChain = async (
  contractReportId,
  agreedBountyUsd,
  deadlineDays = 7
) => {
  await switchToSepolia();
  const contract  = await getContract();
  const amountWei = usdToWei(agreedBountyUsd);
  const deadline  = Math.floor(Date.now() / 1000) + deadlineDays * 24 * 3600;

  console.log(`Locking bounty: $${agreedBountyUsd} = ${ethers.formatEther(amountWei)} ETH`);

  const tx = await contract.lockBounty(
    contractReportId,
    deadline,
    { value: amountWei }
  );
  await tx.wait();

  console.log(`Bounty locked! TxHash: ${tx.hash}`);
  return tx.hash;
};

// ── STEP 3 — Org releases payment → ETH goes to hacker ───
export const releaseBounty = async (contractReportId) => {
  await switchToSepolia();
  const contract = await getContract();

  console.log(`Releasing bounty for contract report ID: ${contractReportId}`);

  const tx = await contract.verifyAndRelease(contractReportId);
  await tx.wait();

  console.log(`Payment released! TxHash: ${tx.hash}`);
  return tx.hash;
};

// ── Hacker raises dispute after deadline ─────────────────
export const raiseDisputeOnChain = async (contractReportId) => {
  await switchToSepolia();
  const contract = await getContract();
  const tx = await contract.raiseDispute(contractReportId);
  await tx.wait();
  return tx.hash;
};

// ── Read contract state ───────────────────────────────────
export const getChainReport = async (contractReportId) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  const r        = await contract.getReport(contractReportId);
  return {
    id:           Number(r.id),
    hacker:       r.hacker,
    organization: r.organization,
    amount:       ethers.formatEther(r.amount),
    minBounty:    ethers.formatEther(r.minBounty),
    status:       Number(r.status),
    deadline:     Number(r.deadline),
  };
};