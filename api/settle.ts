import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { db } from '@/lib/db'; // Turso or DB 연결

const RPC_URL = process.env.BSC_RPC!;
const PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY!;
const WYDA_TOKEN = process.env.WYDA_TOKEN_ADDRESS!;

// ERC20 ABI (transfer만 필요)
const ERC20_ABI = [
  "function transfer(address to, uint amount) public returns (bool)"
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const purchaseId = params.id;

    // 1️⃣ DB 조회
    const purchase = await db.getPurchase(purchaseId);

    if (!purchase) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (purchase.status !== 'completed') {
      return NextResponse.json({ error: 'Not completed yet' }, { status: 400 });
    }

    if (purchase.payout_tx_hash) {
      return NextResponse.json({ error: 'Already settled' }, { status: 400 });
    }

    // 2️⃣ 블록체인 연결
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const contract = new ethers.Contract(
      WYDA_TOKEN,
      ERC20_ABI,
      wallet
    );

    // 3️⃣ 판매자에게 WYDA 송금
    const tx = await contract.transfer(
      purchase.sellerAddress,
      ethers.parseUnits(purchase.price.toString(), 18)
    );

    await tx.wait();

    // 4️⃣ DB 업데이트
    await db.updatePurchase(purchaseId, {
      payout_tx_hash: tx.hash,
      settled_at: Date.now()
    });

    return NextResponse.json({
      success: true,
      txHash: tx.hash
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({
      error: e.message
    }, { status: 500 });
  }
}