export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number; // In WYDA
  imageUrl: string;
  seller: string; // Wallet address
  createdAt: number;
}

export interface WalletState {
  address: string | null;
  balance: string | null;
  isConnected: boolean;
}
