import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import geoip from 'geoip-lite';
import requestIp from 'request-ip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('exyon.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    price REAL,
    imageUrl TEXT,
    seller TEXT,
    createdAt INTEGER,
    views INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    category TEXT,
    downloadUrl TEXT,
    allowBidding INTEGER DEFAULT 0,
    allowCustomOrder INTEGER DEFAULT 0,
    highestBid REAL,
    highestBidder TEXT
  );

  CREATE TABLE IF NOT EXISTS profiles (
    address TEXT PRIMARY KEY,
    ympBalance INTEGER DEFAULT 0,
    lastLoginDate TEXT,
    loginStreak INTEGER DEFAULT 0,
    gamesCompletedToday TEXT,
    lastGameRewardDate TEXT,
    role TEXT DEFAULT 'user',
    followersCount INTEGER DEFAULT 0,
    followingCount INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS followers (
    followerAddress TEXT,
    followingAddress TEXT,
    PRIMARY KEY (followerAddress, followingAddress)
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    address TEXT,
    listingId TEXT,
    PRIMARY KEY (address, listingId)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipientAddress TEXT,
    senderAddress TEXT,
    type TEXT, -- 'comment', 'bid', 'follow', 'purchase'
    listingId TEXT,
    message TEXT,
    isRead INTEGER DEFAULT 0,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    listingId TEXT,
    title TEXT,
    price REAL,
    date INTEGER,
    category TEXT,
    downloadUrl TEXT,
    buyerAddress TEXT
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    listingId TEXT,
    authorAddress TEXT,
    text TEXT,
    timestamp INTEGER
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(requestIp.mw());

  // IP Blocking Middleware
  const BLOCKED_COUNTRIES = ['CN', 'RU', 'BY', 'CU', 'HK', 'MO', 'KP', 'IR'];
  
  app.use((req, res, next) => {
    const ip = req.clientIp;
    if (ip) {
      const geo = geoip.lookup(ip);
      if (geo && BLOCKED_COUNTRIES.includes(geo.country)) {
        return res.status(403).send('Access Denied: Your region is restricted.');
      }
    }
    next();
  });

  // Helper to create notifications
  const createNotification = (recipient: string, sender: string, type: string, message: string, listingId?: string) => {
    if (recipient.toLowerCase() === sender.toLowerCase()) return; // Don't notify self
    const id = Math.random().toString(36).substr(2, 9);
    const stmt = db.prepare('INSERT INTO notifications (id, recipientAddress, senderAddress, type, message, listingId, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, recipient, sender, type, message, listingId || null, Date.now());
  };

  // API Routes
  app.get('/api/geo', (req, res) => {
    const ip = req.clientIp;
    const geo = geoip.lookup(ip || '');
    res.json({ country: geo ? geo.country : 'Unknown' });
  });

  app.get('/api/listings', (req, res) => {
    const { q } = req.query;
    let listings;
    if (q) {
      listings = db.prepare('SELECT * FROM listings WHERE title LIKE ? OR description LIKE ? ORDER BY createdAt DESC').all(`%${q}%`, `%${q}%`);
    } else {
      listings = db.prepare('SELECT * FROM listings ORDER BY createdAt DESC').all();
    }
    res.json(listings.map((l: any) => ({
      ...l,
      allowBidding: !!l.allowBidding,
      allowCustomOrder: !!l.allowCustomOrder
    })));
  });

  app.get('/api/profiles', (req, res) => {
    const { q } = req.query;
    let profiles;
    if (q) {
      profiles = db.prepare('SELECT * FROM profiles WHERE address LIKE ? ORDER BY address ASC').all(`%${q}%`);
    } else {
      profiles = db.prepare('SELECT * FROM profiles ORDER BY address ASC').all();
    }
    res.json(profiles);
  });

  app.post('/api/listings', (req, res) => {
    const listing = req.body;
    // Check if listing already exists
    const existing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id);
    if (existing) {
      if (existing.seller.toLowerCase() !== listing.seller.toLowerCase()) {
        return res.status(403).json({ error: 'Only the seller can update this listing' });
      }
      const stmt = db.prepare(`
        UPDATE listings SET title = ?, description = ?, price = ?, category = ?, downloadUrl = ?, allowBidding = ?, allowCustomOrder = ?
        WHERE id = ?
      `);
      stmt.run(
        listing.title, listing.description, listing.price, listing.category, 
        listing.downloadUrl, listing.allowBidding ? 1 : 0, listing.allowCustomOrder ? 1 : 0,
        listing.id
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO listings (id, title, description, price, imageUrl, seller, createdAt, views, sales, category, downloadUrl, allowBidding, allowCustomOrder)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        listing.id, listing.title, listing.description, listing.price, 
        listing.imageUrl, listing.seller, listing.createdAt, 
        listing.views || 0, listing.sales || 0, listing.category, 
        listing.downloadUrl, listing.allowBidding ? 1 : 0, listing.allowCustomOrder ? 1 : 0
      );
    }
    res.json({ success: true });
  });

  app.post('/api/listings/:id/view', (req, res) => {
    db.prepare('UPDATE listings SET views = views + 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/listings/:id/bid', (req, res) => {
    const { amount, bidder } = req.body;
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
    if (listing) {
      // Notify seller
      createNotification(listing.seller, bidder, 'bid', `New bid of ${amount} WYDA on your item: ${listing.title}`, listing.id);
      
      // Notify previous bidder if exists
      if (listing.highestBidder && listing.highestBidder.toLowerCase() !== bidder.toLowerCase()) {
        createNotification(listing.highestBidder, bidder, 'bid', `You've been outbid on ${listing.title}. New bid: ${amount} WYDA`, listing.id);
      }
    }
    db.prepare('UPDATE listings SET highestBid = ?, highestBidder = ? WHERE id = ?').run(amount, bidder, req.params.id);
    res.json({ success: true });
  });

  app.get('/api/profiles/:address', (req, res) => {
    const profile = db.prepare('SELECT * FROM profiles WHERE address = ?').get(req.params.address);
    if (profile) {
      const wishlist = db.prepare('SELECT listingId FROM wishlist WHERE address = ?').all(req.params.address).map((row: any) => row.listingId);
      const following = db.prepare('SELECT followingAddress FROM followers WHERE followerAddress = ?').all(req.params.address).map((row: any) => row.followingAddress);
      res.json({
        ...profile,
        gamesCompletedToday: JSON.parse(profile.gamesCompletedToday || '{}'),
        purchases: db.prepare('SELECT * FROM purchases WHERE buyerAddress = ? ORDER BY date DESC').all(req.params.address),
        wishlist,
        following
      });
    } else {
      res.status(404).json({ error: 'Profile not found' });
    }
  });

  app.post('/api/profiles', (req, res) => {
    const profile = req.body;
    const existing = db.prepare('SELECT * FROM profiles WHERE address = ?').get(profile.address);
    if (existing && existing.address.toLowerCase() !== profile.address.toLowerCase()) {
       // This shouldn't happen with address as PK, but for safety
       return res.status(403).json({ error: 'Unauthorized' });
    }
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO profiles (address, ympBalance, lastLoginDate, loginStreak, gamesCompletedToday, lastGameRewardDate, role, followersCount, followingCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      profile.address, profile.ympBalance, profile.lastLoginDate, 
      profile.loginStreak, JSON.stringify(profile.gamesCompletedToday), 
      profile.lastGameRewardDate, profile.role,
      profile.followersCount || 0, profile.followingCount || 0
    );
    res.json({ success: true });
  });

  app.post('/api/profiles/:address/follow', (req, res) => {
    const { followerAddress } = req.body;
    const followingAddress = req.params.address;
    try {
      db.prepare('INSERT INTO followers (followerAddress, followingAddress) VALUES (?, ?)').run(followerAddress, followingAddress);
      db.prepare('UPDATE profiles SET followersCount = followersCount + 1 WHERE address = ?').run(followingAddress);
      db.prepare('UPDATE profiles SET followingCount = followingCount + 1 WHERE address = ?').run(followerAddress);
      
      // Notify the user being followed
      createNotification(followingAddress, followerAddress, 'follow', `You have a new follower!`);
      
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: 'Already following' });
    }
  });

  app.post('/api/profiles/:address/unfollow', (req, res) => {
    const { followerAddress } = req.body;
    const followingAddress = req.params.address;
    const result = db.prepare('DELETE FROM followers WHERE followerAddress = ? AND followingAddress = ?').run(followerAddress, followingAddress);
    if (result.changes > 0) {
      db.prepare('UPDATE profiles SET followersCount = followersCount - 1 WHERE address = ?').run(followingAddress);
      db.prepare('UPDATE profiles SET followingCount = followingCount - 1 WHERE address = ?').run(followerAddress);
    }
    res.json({ success: true });
  });

  app.post('/api/listings/:id/wishlist', (req, res) => {
    const { address } = req.body;
    const listingId = req.params.id;
    try {
      db.prepare('INSERT INTO wishlist (address, listingId) VALUES (?, ?)').run(address, listingId);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: 'Already in wishlist' });
    }
  });

  app.post('/api/listings/:id/unwishlist', (req, res) => {
    const { address } = req.body;
    const listingId = req.params.id;
    db.prepare('DELETE FROM wishlist WHERE address = ? AND listingId = ?').run(address, listingId);
    res.json({ success: true });
  });

  app.post('/api/purchases', (req, res) => {
    const { purchase, buyerAddress } = req.body;
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(purchase.listingId);
    if (listing) {
      // Notify seller
      createNotification(listing.seller, buyerAddress, 'purchase', `Your item "${listing.title}" has been purchased for ${listing.price} WYDA!`, listing.id);
    }
    const stmt = db.prepare(`
      INSERT INTO purchases (id, listingId, title, price, date, category, downloadUrl, buyerAddress)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      purchase.id, purchase.listingId, purchase.title, purchase.price, 
      purchase.date, purchase.category, purchase.downloadUrl, buyerAddress
    );
    // Remove listing after purchase
    db.prepare('DELETE FROM listings WHERE id = ?').run(purchase.listingId);
    res.json({ success: true });
  });

  app.get('/api/comments/:listingId', (req, res) => {
    const comments = db.prepare('SELECT * FROM comments WHERE listingId = ? ORDER BY timestamp DESC').all(req.params.listingId);
    res.json(comments);
  });

  app.post('/api/comments', (req, res) => {
    const comment = req.body;
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(comment.listingId);
    if (listing) {
      // Notify seller
      createNotification(listing.seller, comment.authorAddress, 'comment', `New comment on your item: ${listing.title}`, listing.id);
    }
    const stmt = db.prepare('INSERT INTO comments (id, listingId, authorAddress, text, timestamp) VALUES (?, ?, ?, ?, ?)');
    stmt.run(comment.id, comment.listingId, comment.authorAddress, comment.text, comment.timestamp);
    res.json({ success: true });
  });

  // Notification Endpoints
  app.get('/api/notifications/:address', (req, res) => {
    const notifications = db.prepare('SELECT * FROM notifications WHERE recipientAddress = ? ORDER BY timestamp DESC LIMIT 50').all(req.params.address);
    res.json(notifications.map((n: any) => ({ ...n, isRead: !!n.isRead })));
  });

  app.post('/api/notifications/:id/read', (req, res) => {
    db.prepare('UPDATE notifications SET isRead = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/notifications/read-all', (req, res) => {
    const { address } = req.body;
    db.prepare('UPDATE notifications SET isRead = 1 WHERE recipientAddress = ?').run(address);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
