export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number; // In WYDA
  imageUrl: string;
  seller: string; // Wallet address
  createdAt: number;
  views: number; // For popularity sorting
  sales: number;
  category: 'physical' | 'digital';
  downloadUrl?: string; // Only for digital goods
  allowBidding?: boolean;
  allowCustomOrder?: boolean;
  highestBid?: number;
  highestBidder?: string;
}

export interface Bid {
  id: string;
  listingId: string;
  bidder: string;
  amount: number;
  timestamp: number;
}

export interface PurchaseRecord {
  id: string;
  listingId: string;
  title: string;
  price: number;
  date: number;
  category: 'physical' | 'digital';
  downloadUrl?: string;
}

export interface UserProfile {
  address: string;
  ympBalance: number;
  lastLoginDate: string; // YYYY-MM-DD
  loginStreak: number;
  gamesCompletedToday: {
    tetris: boolean;
    pong: boolean;
    backgammon: boolean;
  };
  lastGameRewardDate: string | null;
  purchases: PurchaseRecord[];
  role: 'user' | 'admin';
  followersCount?: number;
  followingCount?: number;
  following?: string[]; // Array of addresses
  wishlist?: string[]; // Array of listing IDs
}

export interface WalletState {
  address: string | null;
  balance: string | null;
  isConnected: boolean;
  profile: UserProfile | null;
}

export interface Comment {
  id: string;
  listingId: string;
  authorAddress: string;
  text: string;
  timestamp: number;
}

export type SortOption = 'newest' | 'price-low' | 'price-high' | 'popular';
