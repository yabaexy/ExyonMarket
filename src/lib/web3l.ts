import { ethers } from 'ethers';

// App.tsx 상단에 추가
import { provideApeLiquidity } from './lib/web3'; // 직접 만드신 함수
import { ExternalLink, Plus, RefreshCw } from 'lucide-react'; // 기존에 사용 중인 아이콘 라이브러리
declare global {
  interface Window {
    ethereum?: any;
  }
}

export const WYDA_CONTRACT_ADDRESS = '0xD84B7E8b295d9Fa9656527AC33Bf4F683aE7d2C4';
export const APESWAP_ROUTER_ADDRESS = '0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607';
export const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint amount)"
];

// ApeSwap Router에 필요한 최소 ABI
export const ROUTER_ABI = [
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)"
];

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install it to use this app.");
  }
  
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  
  return { provider, signer, address };
}

export async function getWYDABalance(address: string, provider: ethers.Provider) {
  const contract = new ethers.Contract(WYDA_CONTRACT_ADDRESS, ERC20_ABI, provider);
  const balance = await contract.balanceOf(address);
  const decimals = await contract.decimals();
  return ethers.formatUnits(balance, decimals);
}

export async function transferWYDA(to: string, amount: string, signer: ethers.Signer) {
  const contract = new ethers.Contract(WYDA_CONTRACT_ADDRESS, ERC20_ABI, signer);
  const decimals = await contract.decimals();
  const parsedAmount = ethers.parseUnits(amount, decimals);
  const tx = await contract.transfer(to, parsedAmount);
  return await tx.wait();
}
// [파일 하단에 LP 공급 함수 추가]
export async function provideApeLiquidity(
  usdtAmount: string, 
  wydaAmount: string, 
  signer: ethers.Signer,
  userAddress: string
) {
  const wydaContract = new ethers.Contract(WYDA_CONTRACT_ADDRESS, ERC20_ABI, signer);
  const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, signer);
  const router = new ethers.Contract(APESWAP_ROUTER_ADDRESS, ROUTER_ABI, signer);

  // 1. WYDA 승인(Enable) 확인 및 실행
  const wydaWei = ethers.parseUnits(wydaAmount, 18);
  const wydaAllowance = await wydaContract.allowance(userAddress, APESWAP_ROUTER_ADDRESS);
  if (wydaAllowance < wydaWei) {
    const tx = await wydaContract.approve(APESWAP_ROUTER_ADDRESS, ethers.MaxUint256);
    await tx.wait();
  }

  // 2. USDT 승인 확인 및 실행
  const usdtWei = ethers.parseUnits(usdtAmount, 18);
  const usdtAllowance = await usdtContract.allowance(userAddress, APESWAP_ROUTER_ADDRESS);
  if (usdtAllowance < usdtWei) {
    const tx = await usdtContract.approve(APESWAP_ROUTER_ADDRESS, ethers.MaxUint256);
    await tx.wait();
  }

  // 3. 유동성 공급 실행 (Add Liquidity)
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20분 유효
  const lpTx = await router.addLiquidity(
    USDT_CONTRACT_ADDRESS,
    WYDA_CONTRACT_ADDRESS,
    usdtWei,
    wydaWei,
    0, // 단순화를 위해 최소 수량 0 설정 (실 서비스 시 슬리피지 고려 필요)
    0,
    userAddress,
    deadline
  );
  return await lpTx.wait();
}