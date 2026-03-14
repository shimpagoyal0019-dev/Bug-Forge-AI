# 🛡️ BugForge AI
### AI-Powered Secure Bug Bounty Verification Platform

> **Automated · Secure · Fair · Blockchain-Powered**

BugForge AI bridges the gap between ethical hackers and organizations by combining **Artificial Intelligence**, **secure sandbox testing**, and **Ethereum smart contracts** into a single automated bug bounty pipeline — making vulnerability disclosure faster, fairer, and more secure.

---

## 📋 Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Existing Solutions](#2-existing-solutions)
3. [Our Solution](#3-our-solution)
4. [Project Overview](#4-project-overview)
5. [Architecture & Workflow](#5-architecture--workflow)
6. [Key Features](#6-key-features)
7. [Technology Stack](#7-technology-stack)
8. [Project Structure](#8-project-structure)
9. [Environment Variables](#9-environment-variables)
10. [Project Setup & Installation](#10-project-setup--installation)
11. [FAQ & Q&A](#11-faq--qa)
12. [Real-World Impact](#12-real-world-impact)

---

## 1. Problem Statement

In today's digital world, cybersecurity has become a major concern. Companies use bug bounty programs where ethical hackers discover and report vulnerabilities in exchange for rewards. Despite the rapid growth of this ecosystem — **70,000+ vulnerabilities reported annually** and **hundreds of millions of dollars** paid in rewards — existing platforms still suffer from four critical problems:

| # | Problem | Description |
|---|---------|-------------|
| 1 | **Manual Verification** | Security teams manually verify each report. The process takes days or weeks, introduces human bias, and delays bounty payments. |
| 2 | **Exploit Theft Risk** | Hackers must share exploit code to prove vulnerabilities. Organizations can access and copy this intellectual property without ever paying. |
| 3 | **Fake / Duplicate Reports** | Platforms receive thousands of low-quality, duplicate, or non-reproducible submissions, wasting security team resources. |
| 4 | **Unfair Bounty Pricing** | Reward amounts depend heavily on human judgment and negotiation, causing similar vulnerabilities to receive wildly different rewards. |

---

## 2. Existing Solutions

Popular platforms like **HackerOne** and **Bugcrowd** have pioneered the bug bounty space, but they operate primarily as coordination tools:

| Platform | Limitations |
|----------|-------------|
| **HackerOne** | Manual triage, inconsistent bounty valuation, no automated exploit verification, exploit privacy concerns. |
| **Bugcrowd** | Human-driven review process, slow turnaround, no sandbox testing, subjective reward decisions. |
| **Synack** | Closed network, expensive, still relies on manual review cycles without automation. |

> **Key Gap:** None of the existing platforms combine AI-driven severity analysis, automated sandbox exploit verification, encrypted exploit storage, and blockchain-based escrow payments into a single integrated workflow.

---

## 3. Our Solution

**BugForge AI** automates the entire bug bounty workflow using three core technologies:

| Technology | Role |
|------------|------|
| **Artificial Intelligence** | Analyzes vulnerability features (CVSS score, exploitability, business impact) and predicts a fair recommended bounty range. |
| **Secure Sandbox** | Runs exploit code and organization test scripts in an isolated Docker container, safely verifying the vulnerability without any risk to real systems. |
| **Blockchain (Ethereum)** | Locks bounty funds in a smart contract before the exploit is revealed; releases payment automatically upon confirmed verification — no trust required. |

---

## 4. Project Overview

BugForge AI provides a fully automated, tamper-proof pipeline for vulnerability disclosure and compensation.

**Mission:** Make vulnerability disclosure faster, fairer, and more secure by combining AI, secure sandboxing, and transparent blockchain payments into one cohesive platform.

### Core Value Propositions

- ⚡ **Verification time:** days/weeks → **minutes**
- 🔒 **Exploit privacy:** end-to-end AES-256 encryption until payment is released
- ⚖️ **Fair rewards:** AI-computed CVSS-based bounty floor, not subjective human judgment
- 💎 **Payment trust:** blockchain escrow eliminates disputes and delays

---

## 5. Architecture & Workflow

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BUGFORGE AI                          │
├───────────────┬──────────────┬─────────────┬────────────────┤
│   Frontend    │   Backend    │  AI Engine  │ Smart Contract │
│  (React.js)   │  (Node.js)   │  (Python)   │  (Solidity)    │
│               │              │             │                │
│ Hacker Portal │ REST API +   │ ML Scoring  │ Escrow Lock    │
│ Org Portal    │ WebSockets   │ CVSS Pred.  │ Auto Release   │
│ MetaMask      │ AES-256 Enc  │ FastAPI     │ Sepolia EVM    │
└───────────────┴──────────────┴─────────────┴────────────────┘
```

| Layer | Responsibility |
|-------|----------------|
| **Frontend (React)** | Hacker Portal — submit reports, negotiate bounties, track status. Org Portal — add test cases, run sandbox, lock/release escrow. |
| **Backend (Node.js / Express)** | REST API + WebSocket events, MongoDB persistence, AES-256 exploit encryption, JWT authentication, sandbox orchestration. |
| **AI Engine (Python / FastAPI)** | Feature extraction from bug reports, CVSS scoring, ML-based bounty range prediction. |
| **Smart Contract (Solidity / Hardhat)** | On-chain report registration, ETH escrow lock, automatic payment release, dispute handling on Sepolia testnet. |

---

### 5.2 End-to-End Workflow

The diagram below shows the full interaction between the **Hacker**, **Platform**, and **Organization**:

```
Hacker                    Platform                        Org
  │                          │                             │
  │── Submit Report ────────▶│                             │
  │   (vuln + sim script)    │                             │
  │                          │── ML scores it              │
  │                          │   (CVSS + bounty floor)     │
  │                          │                             │
  │                          │── Encrypt exploit ─────────▶│── Org writes tests
  │                          │                             │
  │                          │◀──────── Sandbox runs ──────│
  │                          │   (org tests vs hacker sim) │
  │                          │                             │
  │◀──────── Negotiation ────│────── report visible ──────▶│
  │          (ML floor,      │                             │
  │◀── hacker counters ──────│      org proposes)          │
  │                          │                             │
  │                          │◀──── Org locks ETH escrow ──│
  │                          │      (on-chain via MetaMask) │
  │                          │                             │
  │◀── bounty paid ──────────│──── Org releases payment ──▶│── exploit unlocked
                                    (exploit revealed
                                     on-chain)
```

**Step-by-step breakdown:**

**Step 1 — Hacker Submission**
- Hacker submits: title, description, vulnerability type, exploit simulation code, affected system, and wallet address.
- Exploit code is **AES-256 encrypted** before storage — the organization cannot access it until payment is released.

**Step 2 — AI Bounty Evaluation**
- AI Engine extracts features: CVSS score, exploitability level, impact severity, affected users.
- ML model predicts: minimum bounty floor + recommended bounty range.
- Example output: `AI Recommended Bounty: $5,200`

**Step 3 — Organization Test Cases**
- Organization reviews the vulnerability report (without seeing the exploit code).
- Writes test scripts against `hackerEnv` exports — prints `VULNERABILITY_CONFIRMED` to pass.

**Step 4 — Secure Sandbox Verification**
- Platform spins up an isolated Docker container.
- Runs: hacker exploit simulation + organization test scripts together.
- Result: **PASS** (vulnerability confirmed) or **FAIL** (not reproducible).

**Step 5 — Negotiation**
- Both parties negotiate the final bounty amount above the AI-computed floor.
- Real-time chat and proposal/counter-proposal system built in.

**Step 6 — Blockchain Escrow & Payment**
- Organization locks the agreed bounty in an Ethereum smart contract (Sepolia testnet) via MetaMask.
- After confirmation, payment releases automatically to the hacker's wallet.
- Exploit code is then decrypted and revealed to the organization.

---

### 5.3 Sandbox Environment

```
Sandbox Container (Docker)
│
├── Hacker Exploit Simulation  (decrypted for execution only)
├── Organization Test Scripts
└── Output Monitor             (captures VULNERABILITY_CONFIRMED)
```

| Property | Detail |
|----------|--------|
| **Isolation** | Docker container — no access to host filesystem or production network. |
| **Safety** | Real systems are never touched; exploit runs only inside the container. |
| **Automation** | Verification is fully automated — no human needs to manually review the exploit. |
| **Reset** | Container is destroyed and recreated for every sandbox run. |

---

### 5.4 AI Model Flow

```
Bug Report Input
      ↓
Feature Extraction
(CVSS score, exploitability level, impact severity, affected user count)
      ↓
Machine Learning Model
(trained on historical bug bounty data)
      ↓
Output: Minimum Bounty Floor  +  Recommended Bounty Range
```

---

## 6. Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Bounty Prediction** | ML model analyzes CVSS score, exploitability, and business impact to predict a fair and consistent bounty floor. |
| 🔐 **Encrypted Exploit Storage** | Exploit code is AES-256 encrypted before storage. The organization cannot read it until ETH payment is released. |
| 🧪 **Automated Sandbox Testing** | Docker-based isolated environment runs exploit + test scripts server-side. Eliminates manual verification entirely. |
| ⛓️ **Blockchain Escrow** | Smart contract locks ETH before the exploit is shared. Payment releases automatically when the vulnerability is confirmed. |
| 💬 **Real-Time Communication** | WebSocket-based live chat between hackers and organizations, with real-time sandbox progress and status updates. |
| 🤝 **Bounty Negotiation** | Both parties can propose and counter-propose bounty amounts within the AI-computed floor. Full proposal history is retained. |
| ⚖️ **On-Chain Dispute Resolution** | Hacker can raise a dispute on-chain if payment is not released within the agreed deadline. |
| 🏢 **Organisation Directory** | Hackers can browse registered organizations, view report history, paid bounties, and submit reports directly. |
| 🦊 **MetaMask Integration** | Seamless wallet connection. Report registration, escrow lock, and payment release are all signed in-browser. |
| 🔑 **JWT Authentication** | Separate hacker and organization accounts with role-based access control and secure JWT sessions. |

---

## 7. Technology Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React.js, Space Mono / Syne fonts, Socket.io client, ethers.js, MetaMask |
| **Backend** | Node.js, Express.js, MongoDB (Mongoose), Socket.io, JWT, AES-256 encryption |
| **AI Engine** | Python, FastAPI, scikit-learn, pandas, NumPy |
| **Smart Contract** | Solidity, Hardhat, ethers.js, Sepolia testnet (Infura RPC) |
| **Infrastructure** | Docker (sandbox), MongoDB Atlas, Render (AI engine hosting) |

---

## 8. Project Structure

```
BUGFORGE AI/
  ├── ai-engine/                  # Python FastAPI service — ML scoring & bounty prediction
  │   ├── __pycache__/
  │   ├── data/
  │   ├── model/
  │   ├── saved_model/
  │   ├── schemas/
  │   ├── main.py
  │   └── requirements.txt
  │
  ├── backend/                    # Node.js / Express REST API + WebSocket server
  │   ├── config/
  │   ├── controllers/
  │   ├── middleware/
  │   ├── models/
  │   ├── node_modules/
  │   ├── routes/
  │   ├── .env
  │   ├── .gitignore
  │   ├── app.js
  │   ├── package-lock.json
  │   └── package.json
  │
  ├── BugForge Contracts/         # Solidity smart contract + Hardhat deployment scripts
  │   ├── artifacts/
  │   ├── cache/
  │   ├── contracts/
  │   ├── ignition/
  │   ├── node_modules/
  │   ├── scripts/
  │   ├── test/
  │   ├── types/
  │   ├── .env
  │   ├── .gitignore
  │   ├── hardhat.config.ts
  │   ├── package-lock.json
  │   ├── package.json
  │   ├── README.md
  │   └── tsconfig.json
  │
  └── frontend/                   # React.js Hacker Portal + Org Portal
      ├── node_modules/
      ├── public/
      ├── src/
      ├── .env
      ├── .gitignore
      ├── package-lock.json
      ├── package.json
      └── README.md
```

---

## 9. Environment Variables

> ⚠️ **Never commit `.env` files to version control. Add `.env` to `.gitignore` in all four directories before pushing.**

### 9.1 Smart Contract — `BugForge Contracts/.env`

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
SEPOLIA_PRIVATE_KEY=YOUR_DEPLOYER_WALLET_PRIVATE_KEY
```

### 9.2 Backend — `backend/.env`

```env
PORT=5000
MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
JWT_SECRET=YOUR_JWT_SECRET_KEY
CONTRACT_ADDRESS=YOUR_DEPLOYED_CONTRACT_ADDRESS
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
ADMIN_PRIVATE_KEY=YOUR_ADMIN_WALLET_PRIVATE_KEY
ENCRYPT_KEY=YOUR_32_BYTE_ENCRYPTION_KEY
AI_ENGINE_URL=YOUR_AI_ENGINE_URL
```

### 9.3 Frontend — `frontend/.env`

```env
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_CONTRACT_ADDRESS=YOUR_DEPLOYED_CONTRACT_ADDRESS
REACT_APP_AI_ENGINE_URL=http://localhost:8000
```

---

## 10. Project Setup & Installation

### Prerequisites

- Node.js >= 18.x
- Python >= 3.10
- MongoDB Atlas account (or local MongoDB)
- MetaMask browser extension + Sepolia testnet ETH
- Infura account for Sepolia RPC URL
- Docker (for sandbox execution)

---

### 10.1 Smart Contract

```bash
cd "BugForge Contracts"
npm install

# Fill in your .env values (see Section 9.1)
cp .env.example .env

# Compile the contract
npx hardhat compile

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia

# Copy the printed contract address into backend/.env and frontend/.env
```

---

### 10.2 AI Engine

```bash
cd ai-engine

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate          # macOS / Linux
venv\Scripts\activate             # Windows

pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

---

### 10.3 Backend

```bash
cd backend
npm install

# Fill in your .env values (see Section 9.2)
cp .env.example .env

# Start the server
npm run dev        # or: node app.js
```

---

### 10.4 Frontend

```bash
cd frontend
npm install

# Fill in your .env values (see Section 9.3)
cp .env.example .env

# Start the React development server
npm start
```

---

> ✅ **Recommended start order:** `AI Engine` → `Backend` → `Frontend`
>
> The backend depends on the AI engine being reachable before it can score submitted reports.

---

## 11. FAQ & Q&A

**Q1: Why would companies use this platform?**
> Companies get faster vulnerability verification, reduced security team workload, and AI-based bounty evaluation for fair and consistent rewards. Exploit privacy protection also builds stronger trust with the hacker community.

**Q2: How is sandbox security ensured?**
> The sandbox runs in an isolated Docker container with restricted network access, limited OS permissions, and automatic environment reset after each run. Exploits have no path to affect the host system.

**Q3: Why use blockchain?**
> Smart contracts ensure bounty funds are locked before the exploit is accessible, and payment releases automatically after verification is confirmed. This eliminates payment disputes and removes the need for either party to trust the other.

**Q4: What if the AI gives a wrong bounty prediction?**
> The AI recommendation is only a baseline suggestion and a minimum floor. Both the hacker and the organization can negotiate the final reward through the built-in proposal and counter-proposal system.

**Q5: What happens if the org doesn't release payment?**
> The hacker can raise an on-chain dispute after the payment deadline. The dispute is recorded immutably on the Ethereum blockchain and can be reviewed by platform administrators.

---

## 12. Real-World Impact

| Impact Area | Expected Outcome |
|-------------|-----------------|
| ⚡ **Verification Speed** | Automation reduces verification time from days or weeks down to minutes. |
| ⚖️ **Fair Compensation** | AI model ensures consistent and objective bounty recommendations across all reports. |
| 🧹 **Reduced Workload** | Security teams focus only on confirmed, sandbox-verified vulnerabilities. |
| 🔒 **Hacker Trust** | End-to-end encrypted exploit storage protects intellectual property until payment is received. |
| 🔍 **Payment Transparency** | All transactions are recorded on-chain — no hidden delays or arbitrary rejections. |
| 🛡️ **Ecosystem Quality** | Automated filtering eliminates fake, duplicate, and non-reproducible reports at submission time. |

---

<div align="center">

**BugForge AI — Faster. Fairer. More Secure.**

`AI` · `Sandbox` · `Blockchain` · `Bug Bounty` · `Sepolia Testnet`

</div>
