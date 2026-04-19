export type ListingCategory = 'Living' | 'Automotive' | 'Electronics' | 'Others';

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
  category: ListingCategory;
  isDigital: boolean;
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

export type EscrowStatus = 'escrow_pending' | 'shipped' | 'completed' | 'refunded';

export interface PurchaseRecord {
  id: string;
  listingId: string;
  title: string;
  price: number;
  date: number;
  category: ListingCategory;
  isDigital: boolean;
  downloadUrl?: string;
  buyerAddress: string;
  sellerAddress: string;
  status: EscrowStatus;
  shippingAddressId?: string | null;
  shippingAddress?: ShippingAddress | null;
}



export interface ShippingAddress {
  id: string;
  label: string;
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  phone?: string;
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
  nickname?: string;
  avatarUrl?: string;
  followersCount?: number;
  followingCount?: number;
  following?: string[]; // Array of addresses
  wishlist?: string[]; // Array of listing IDs
  shippingAddresses?: ShippingAddress[];
  defaultShippingAddressId?: string | null;
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

export interface Notification {
  id: string;
  recipientAddress: string;
  senderAddress: string;
  type: 'comment' | 'bid' | 'follow' | 'purchase';
  listingId?: string;
  message: string;
  isRead: boolean;
  timestamp: number;
}

export type SortOption = 'newest' | 'price-low' | 'price-high' | 'popular';
