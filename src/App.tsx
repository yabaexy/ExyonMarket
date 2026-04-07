import { useState, useEffect, useCallback, FormEvent } from 'react';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  Plus, 
  ShoppingBag, 
  Search, 
  ArrowRight, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Tag,
  Clock,
  User
} from 'lucide-react';
import { connectWallet, getWYDABalance, transferWYDA, WYDA_CONTRACT_ADDRESS } from './lib/web3';
import { Listing, WalletState } from './types';

// Mock initial data
const INITIAL_LISTINGS: Listing[] = [
  {
    id: '1',
    title: 'Vintage Film Camera',
    description: 'A classic 35mm film camera in excellent condition. Perfect for enthusiasts.',
    price: 500,
    imageUrl: 'https://picsum.photos/seed/camera/800/600',
    seller: '0x1234...5678',
    createdAt: Date.now() - 86400000,
  },
  {
    id: '2',
    title: 'Mechanical Keyboard',
    description: 'Custom built mechanical keyboard with tactile switches and RGB lighting.',
    price: 1200,
    imageUrl: 'https://picsum.photos/seed/keyboard/800/600',
    seller: '0xabcd...efgh',
    createdAt: Date.now() - 172800000,
  },
  {
    id: '3',
    title: 'Designer Sunglasses',
    description: 'Authentic designer sunglasses, barely worn. Comes with original case.',
    price: 800,
    imageUrl: 'https://picsum.photos/seed/glasses/800/600',
    seller: '0x9876...5432',
    createdAt: Date.now() - 259200000,
  }
];

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balance: null,
    isConnected: false,
  });
  const [listings, setListings] = useState<Listing[]>([]);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  // Load listings from local storage or initial data
  useEffect(() => {
    const saved = localStorage.getItem('wyda_listings');
    if (saved) {
      setListings(JSON.parse(saved));
    } else {
      setListings(INITIAL_LISTINGS);
    }
  }, []);

  // Save listings to local storage
  useEffect(() => {
    if (listings.length > 0) {
      localStorage.setItem('wyda_listings', JSON.stringify(listings));
    }
  }, [listings]);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const { address, provider } = await connectWallet();
      const balance = await getWYDABalance(address, provider);
      setWallet({ address, balance, isConnected: true });
      setStatus({ type: 'success', message: 'Wallet connected successfully!' });
    } catch (error: any) {
      console.error(error);
      setStatus({ type: 'error', message: error.message || 'Failed to connect wallet' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuy = async (listing: Listing) => {
    if (!wallet.isConnected) {
      handleConnect();
      return;
    }

    try {
      setIsLoading(true);
      setStatus({ type: 'info', message: 'Processing payment... Please confirm in MetaMask.' });
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Real transfer logic
      await transferWYDA(listing.seller, listing.price.toString(), signer);
      
      // Update local state (remove listing after purchase)
      setListings(prev => prev.filter(l => l.id !== listing.id));
      setSelectedListing(null);
      
      // Refresh balance
      const newBalance = await getWYDABalance(wallet.address!, provider);
      setWallet(prev => ({ ...prev, balance: newBalance }));
      
      setStatus({ type: 'success', message: `Successfully purchased ${listing.title}!` });
    } catch (error: any) {
      console.error(error);
      setStatus({ type: 'error', message: error.message || 'Transaction failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddListing = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newListing: Listing = {
      id: Math.random().toString(36).substr(2, 9),
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      price: Number(formData.get('price')),
      imageUrl: `https://picsum.photos/seed/${Math.random()}/800/600`,
      seller: wallet.address || 'Anonymous',
      createdAt: Date.now(),
    };

    setListings(prev => [newListing, ...prev]);
    setIsSellModalOpen(false);
    setStatus({ type: 'success', message: 'Item listed successfully!' });
  };

  const filteredListings = listings.filter(l => 
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-bg font-bold">W</div>
            <span className="font-bold text-xl tracking-tight uppercase">WYDA Market</span>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
              <input 
                type="text" 
                placeholder="Search items..." 
                className="w-full bg-ink/5 border border-line/20 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:border-primary transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {wallet.isConnected ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[10px] uppercase opacity-50 font-bold">Balance</span>
                  <span className="font-mono font-bold text-sm">{Number(wallet.balance).toFixed(2)} WYDA</span>
                </div>
                <div className="h-10 px-4 bg-ink text-bg rounded-full flex items-center gap-2 font-mono text-sm border border-line">
                  <Wallet className="w-4 h-4" />
                  {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                </div>
              </div>
            ) : (
              <button 
                onClick={handleConnect}
                disabled={isLoading}
                className="h-10 px-6 bg-primary text-bg rounded-full font-bold hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Status Toast */}
        <AnimatePresence>
          {status && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-4 rounded-xl border flex items-center justify-between ${
                status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-700' :
                status.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-700' :
                'bg-blue-500/10 border-blue-500/20 text-blue-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : 
                 status.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
                 <Clock className="w-5 h-5" />}
                <p className="font-medium">{status.message}</p>
              </div>
              <button onClick={() => setStatus(null)}><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero */}
        <section className="mb-12">
          <div className="bg-ink text-bg rounded-3xl p-8 md:p-12 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 leading-none">
                TRADE SECOND-HAND <br />
                <span className="text-primary italic">WITH WYDA TOKEN</span>
              </h1>
              <p className="text-bg/60 text-lg mb-8 max-w-lg">
                The most secure way to buy and sell pre-loved items on Binance Smart Chain. 
                Zero middleman, instant settlements.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setIsSellModalOpen(true)}
                  className="px-8 py-4 bg-primary text-bg rounded-full font-bold text-lg hover:scale-105 transition-transform flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  List an Item
                </button>
                <a 
                  href={`https://bscscan.com/token/${WYDA_CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-8 py-4 bg-bg/10 text-bg rounded-full font-bold text-lg hover:bg-bg/20 transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  WYDA Contract
                </a>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
              <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 bg-primary rounded-full blur-[120px]" />
            </div>
          </div>
        </section>

        {/* Listings Grid */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tight uppercase flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" />
              Latest Listings
            </h2>
            <div className="text-sm font-mono opacity-50">
              Showing {filteredListings.length} items
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => (
              <motion.div 
                layoutId={listing.id}
                key={listing.id}
                onClick={() => setSelectedListing(listing)}
                className="group cursor-pointer bg-white border border-line/10 rounded-2xl overflow-hidden hover:border-primary/50 transition-colors"
              >
                <div className="aspect-[4/3] overflow-hidden relative">
                  <img 
                    src={listing.imageUrl} 
                    alt={listing.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 right-4 bg-primary text-bg px-3 py-1 rounded-full font-mono font-bold text-sm shadow-lg">
                    {listing.price} WYDA
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3 h-3 text-primary" />
                    <span className="text-[10px] uppercase font-bold opacity-40 tracking-widest">Marketplace Item</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{listing.title}</h3>
                  <p className="text-ink/60 text-sm line-clamp-2 mb-4">{listing.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-line/5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-ink/10 rounded-full flex items-center justify-center">
                        <User className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-mono opacity-50">{listing.seller.slice(0, 6)}...</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary font-bold text-sm">
                      View Details <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredListings.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-ink/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-ink/20" />
              </div>
              <h3 className="text-xl font-bold mb-2">No items found</h3>
              <p className="text-ink/50">Try adjusting your search or list a new item.</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-ink text-bg/40 py-12 border-t border-line">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4 text-bg">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-bg font-bold text-xs">W</div>
              <span className="font-bold text-lg tracking-tight uppercase">WYDA Market</span>
            </div>
            <p className="max-w-sm mb-6">
              The premier decentralized marketplace for the WYDA community. 
              Built for speed, security, and lower fees on Binance Smart Chain.
            </p>
          </div>
          <div>
            <h4 className="text-bg font-bold uppercase text-xs tracking-widest mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-primary">How it works</a></li>
              <li><a href="#" className="hover:text-primary">WYDA Token</a></li>
              <li><a href="#" className="hover:text-primary">BSCScan</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-bg font-bold uppercase text-xs tracking-widest mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-primary">Help Center</a></li>
              <li><a href="#" className="hover:text-primary">Terms of Service</a></li>
              <li><a href="#" className="hover:text-primary">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-12 mt-12 border-t border-bg/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p>© 2026 WYDA Marketplace. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Powered by Binance Smart Chain</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Network Status: Online</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Item Detail Modal */}
      <AnimatePresence>
        {selectedListing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedListing(null)}
              className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
            />
            <motion.div 
              layoutId={selectedListing.id}
              className="relative bg-bg w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              <div className="md:w-1/2 aspect-square md:aspect-auto">
                <img 
                  src={selectedListing.imageUrl} 
                  alt={selectedListing.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="md:w-1/2 p-8 md:p-12 flex flex-col">
                <button 
                  onClick={() => setSelectedListing(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-ink/5 rounded-full flex items-center justify-center hover:bg-ink/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Tag className="w-4 h-4 text-primary" />
                    <span className="text-xs uppercase font-bold opacity-40 tracking-widest">Marketplace Item</span>
                  </div>
                  <h2 className="text-4xl font-bold mb-4 tracking-tight leading-none">{selectedListing.title}</h2>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-mono font-bold text-xl">
                      {selectedListing.price} WYDA
                    </div>
                    <div className="text-xs font-mono opacity-50">
                      Seller: {selectedListing.seller}
                    </div>
                  </div>
                  <p className="text-ink/70 text-lg leading-relaxed mb-8">
                    {selectedListing.description}
                  </p>
                </div>

                <div className="pt-8 border-t border-line/10">
                  <button 
                    onClick={() => handleBuy(selectedListing)}
                    disabled={isLoading}
                    className="w-full py-4 bg-ink text-bg rounded-full font-bold text-lg hover:bg-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? <Clock className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
                    Buy with WYDA
                  </button>
                  <p className="text-center text-[10px] uppercase font-bold opacity-30 mt-4 tracking-widest">
                    Transaction will be processed on BSC
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sell Modal */}
      <AnimatePresence>
        {isSellModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSellModalOpen(false)}
              className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-bg w-full max-w-lg rounded-3xl p-8 shadow-2xl"
            >
              <button 
                onClick={() => setIsSellModalOpen(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-ink/5 rounded-full flex items-center justify-center hover:bg-ink/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-3xl font-bold mb-6 tracking-tight">List New Item</h2>
              
              <form onSubmit={handleAddListing} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase font-bold opacity-50 mb-2 tracking-widest">Item Title</label>
                  <input 
                    required
                    name="title"
                    type="text" 
                    placeholder="e.g. Vintage Camera"
                    className="w-full bg-ink/5 border border-line/10 rounded-xl p-4 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold opacity-50 mb-2 tracking-widest">Description</label>
                  <textarea 
                    required
                    name="description"
                    placeholder="Describe your item..."
                    rows={4}
                    className="w-full bg-ink/5 border border-line/10 rounded-xl p-4 focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold opacity-50 mb-2 tracking-widest">Price (WYDA)</label>
                  <div className="relative">
                    <input 
                      required
                      name="price"
                      type="number" 
                      placeholder="0.00"
                      className="w-full bg-ink/5 border border-line/10 rounded-xl p-4 pl-12 focus:outline-none focus:border-primary transition-colors font-mono"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-primary">W</div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={!wallet.isConnected}
                  className="w-full py-4 bg-primary text-bg rounded-full font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {wallet.isConnected ? (
                    <>
                      <Plus className="w-5 h-5" />
                      Create Listing
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5" />
                      Connect Wallet to List
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
