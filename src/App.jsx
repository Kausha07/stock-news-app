import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, ExternalLink, MessageSquare, TrendingUp, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToStockNews, db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { PushNotifications } from '@capacitor/push-notifications';
import './App.css';

const ALL_STOCKS = [
  "HEROMOTOCO.NS", "AFIL.NS", "CANBK.NS", "BANKBARODA.NS", "UJJIVANSFB.NS", 
  "HPAL.NS", "CERA.NS", "AWL.NS", "ELECON.NS", "ENVINF.NS", 
  "MOLDTKPAC.NS", "PNGADGIL.NS", "TANLA.NS", "STALIF.NS", "LLOYDSENG.NS", 
  "WAAREERTL.NS", "SWAVI.NS", "SYNFOR.NS", "SAGINI.NS", "JPPOWER.NS", 
  "NTPC.NS", "RTNINDIA.NS", "SCI.NS"
];

// Helper to format Date banners (Today, Yesterday, or long Date)
const formatDateHeader = (date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }
};

// Helper to get time string from message
const formatMessageTime = (msg) => {
  let date = null;
  if (msg.timestamp) {
    date = msg.timestamp.seconds ? new Date(msg.timestamp.seconds * 1000) : new Date(msg.timestamp);
  } else if (msg.published) {
    date = new Date(msg.published);
  }
  
  if (!date || isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Mock stock prices for the top marquee ticker
const INITIAL_PRICES = [
  { ticker: "HEROMOTOCO", price: "4,625.50", change: "+1.85%", up: true },
  { ticker: "BANKBARODA", price: "268.40", change: "-0.45%", up: false },
  { ticker: "CANBK", price: "115.30", change: "+2.15%", up: true },
  { ticker: "NTPC", price: "354.20", change: "+0.90%", up: true },
  { ticker: "SCI", price: "245.00", change: "-1.10%", up: false },
  { ticker: "TANLA", price: "912.80", change: "+0.25%", up: true },
  { ticker: "JPPOWER", price: "18.45", change: "+4.95%", up: true },
  { ticker: "AWL", price: "348.90", change: "-0.15%", up: false },
];

export default function App() {
  const [news, setNews] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(ALL_STOCKS[0]); // Default to first stock
  const [prices, setPrices] = useState(INITIAL_PRICES);
  const messagesEndRef = useRef(null);

  // Keep track of when each stock channel was last viewed (persisted in localStorage)
  const [lastReadTimes, setLastReadTimes] = useState(() => {
    let loaded = {};
    try {
      const stored = localStorage.getItem('lastReadTimes');
      if (stored) {
        loaded = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load lastReadTimes from localStorage:", e);
    }

    // Ensure all current ALL_STOCKS are initialized
    const now = Date.now();
    let updated = false;
    ALL_STOCKS.forEach(ticker => {
      if (loaded[ticker] === undefined) {
        loaded[ticker] = now;
        updated = true;
      }
    });

    if (updated) {
      try {
        localStorage.setItem('lastReadTimes', JSON.stringify(loaded));
      } catch (e) {
        console.error("Failed to save initialized lastReadTimes:", e);
      }
    }
    return loaded;
  });

  // Mark the currently selected stock channel as read when channel changes or new news comes in
  useEffect(() => {
    setLastReadTimes(prev => {
      const updated = {
        ...prev,
        [selectedChannel]: Date.now()
      };
      try {
        localStorage.setItem('lastReadTimes', JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save lastReadTimes to localStorage:", e);
      }
      return updated;
    });
  }, [selectedChannel, news]);

  // Subscribe to real-time stock news from Firebase
  useEffect(() => {
    const unsubscribe = subscribeToStockNews((list) => {
      setNews(list);
    });
    return () => unsubscribe();
  }, []);

  // Register push notifications when app mounts (runs on Android device/emulator)
  useEffect(() => {
    const setupPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.warn('User denied push permissions.');
          return;
        }
        
        await PushNotifications.register();
        
        // Create standard notification channel with high importance for Android
        try {
          await PushNotifications.createChannel({
            id: 'stock-alerts',
            name: 'Stock Alerts',
            description: 'High priority notifications for stock price changes and news',
            importance: 5, // IMPORTANCE_HIGH (Android)
            visibility: 1, // VISIBILITY_PUBLIC
            sound: 'default',
            vibration: true,
          });
          console.log('Push notification channel created: stock-alerts');
        } catch (channelError) {
          console.error('Failed to create notification channel:', channelError);
        }
        
        PushNotifications.addListener('registration', async (token) => {
          console.log('Push Token registered successfully:', token.value);
          // Save the device token in the Firestore 'notification_tokens' collection
          await setDoc(doc(db, "notification_tokens", token.value), {
            token: token.value,
            timestamp: serverTimestamp()
          });
        });
        
        PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration error:', err);
        });
        
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received: ', notification);
        });
        
      } catch (e) {
        console.warn('Push notifications initialization skipped (not running on a native platform).', e);
      }
    };
    
    setupPush();
  }, []);

  // Auto-scroll to the bottom of the chat when messages update or active channel changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [news, selectedChannel]);

  // Update simulated stock prices in the marquee ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => prev.map(p => {
        const currentVal = parseFloat(p.price.replace(',', ''));
        const multiplier = p.up ? 1.001 : 0.999;
        const newVal = (currentVal * multiplier).toFixed(2);
        return {
          ...p,
          price: parseFloat(newVal).toLocaleString(undefined, { minimumFractionDigits: 2 }),
          up: Math.random() > 0.4 ? p.up : !p.up
        };
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch the latest news alert preview for a specific stock ticker
  const getLatestNewsForStock = (ticker) => {
    const stockNews = news.filter(n => n.ticker === ticker);
    if (stockNews.length === 0) return null;
    
    // Sort by timestamp descending
    stockNews.sort((a, b) => {
      const timeA = a.timestamp?.seconds ? a.timestamp.seconds : new Date(a.published).getTime();
      const timeB = b.timestamp?.seconds ? b.timestamp.seconds : new Date(b.published).getTime();
      return timeB - timeA;
    });
    return stockNews[0];
  };

  // Filter stocks by search query in the sidebar
  const filteredStocksList = ALL_STOCKS.filter(ticker => 
    ticker.toLowerCase().includes(search.toLowerCase())
  );

  // Get and sort news for the currently active stock channel
  const activeChannelNews = news.filter(item => item.ticker === selectedChannel);
  
  // Group current channel's news by date (Today, Yesterday, or long date)
  const getGroupedMessages = (messages) => {
    const groups = {};
    messages.forEach(msg => {
      let dateStr = "Older News";
      let msgDate = null;
      
      if (msg.timestamp) {
        msgDate = msg.timestamp.seconds ? new Date(msg.timestamp.seconds * 1000) : new Date(msg.timestamp);
      } else if (msg.published) {
        msgDate = new Date(msg.published);
      }
      
      if (msgDate && !isNaN(msgDate.getTime())) {
        dateStr = formatDateHeader(msgDate);
      }
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(msg);
    });

    // Sort messages in each group by time (ascending order, old news on top, new at bottom)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds : new Date(a.published).getTime();
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds : new Date(b.published).getTime();
        return timeA - timeB;
      });
    });

    return groups;
  };

  const groupedNews = getGroupedMessages(activeChannelNews);

  return (
    <div className="app-container">
      
      {/* 1. TOP MARQUEE TICKER */}
      <section className="ticker-container" aria-label="Live Stock Prices Marquee">
        <div className="ticker-wrapper">
          {prices.concat(prices).map((item, idx) => (
            <div key={idx} className="ticker-item">
              <span className="ticker-code">{item.ticker}</span>
              <span className="ticker-price">₹{item.price}</span>
              <span className={`ticker-change ${item.up ? 'up' : 'down'}`}>
                {item.up ? '▲' : '▼'} {item.change}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. APP MAIN HEADER */}
      <header className="app-header">
        <div className="header-logo">
          <div className="logo-badge">
            <TrendingUp size={18} className="text-zinc-950" />
          </div>
          <div className="logo-text">
            <h1>StockPulse</h1>
            <p>Live Stock Channels</p>
          </div>
        </div>
      </header>

      {/* 3. DASHBOARD GRID */}
      <main className="dashboard-grid">
        
        {/* Left Sidebar (Channels List) */}
        <aside className="chat-sidebar">
          <div className="search-section">
            <div className="search-box">
              <Search className="search-icon" size={14} />
              <input 
                type="text" 
                placeholder="Search stock channels..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                id="search-input"
              />
            </div>
          </div>

          <div className="chat-channels-list">
            {filteredStocksList.map((ticker, idx) => {
              const isActive = selectedChannel === ticker;
              const latestMsg = getLatestNewsForStock(ticker);
              const initials = ticker.replace('.NS', '').substring(0, 2);
              const avatarClass = `chat-avatar avatar-${idx % 5}`;
              
              // Calculate unread news items for this stock
              const lastRead = lastReadTimes[ticker] || 0;
              const stockNews = news.filter(n => n.ticker === ticker);
              const unreadCount = stockNews.filter(n => {
                const msgTime = n.timestamp?.seconds ? n.timestamp.seconds * 1000 : new Date(n.published).getTime();
                return msgTime > lastRead;
              }).length;
              
              return (
                <div 
                  key={ticker} 
                  onClick={() => setSelectedChannel(ticker)}
                  className={`chat-list-item ${isActive ? 'active' : ''}`}
                >
                  <div className={avatarClass}>
                    {initials}
                  </div>
                  
                  <div className="chat-info">
                    <div className="chat-row-top">
                      <span className="chat-title">{ticker.replace('.NS', '')}</span>
                      {latestMsg && (
                        <span className="chat-item-time">
                          {formatMessageTime(latestMsg)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="chat-preview" style={{ flex: 1, paddingRight: '8px' }}>
                        {latestMsg ? latestMsg.title : "No recent messages"}
                      </span>
                      {unreadCount > 0 && !isActive && (
                        <span className="unread-badge">{unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Content Area (Chat Window) */}
        <section className="chat-window">
          
          {/* Header of active chat */}
          <div className="chat-window-header">
            <div className={`chat-avatar avatar-${ALL_STOCKS.indexOf(selectedChannel) % 5}`} style={{ width: '38px', height: '38px', fontSize: '11px' }}>
              {selectedChannel.replace('.NS', '').substring(0, 2)}
            </div>
            <div className="chat-header-details">
              <h3>{selectedChannel.replace('.NS', '')} Channel Feed</h3>
              <p>• Online updates</p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-messages-container">
            {activeChannelNews.length === 0 ? (
              <div className="chat-welcome-container">
                <div className="welcome-badge">
                  <MessageSquare size={28} />
                </div>
                <h3>No messages in this chat</h3>
                <p>Google News RSS feed alerts for {selectedChannel.replace('.NS', '')} will display here when they are published.</p>
              </div>
            ) : (
              // Loop through grouped dates
              Object.keys(groupedNews).map(dateKey => (
                <React.Fragment key={dateKey}>
                  
                  {/* Center Date Header */}
                  <div className="chat-date-banner">
                    <div className="date-badge">{dateKey}</div>
                  </div>
                  
                  {/* Render messages for that date */}
                  {groupedNews[dateKey].map((item, idx) => (
                    <div key={item.id || idx} className="chat-message-row">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="chat-bubble"
                      >
                        {item.summary ? (
                          <>
                            <h4 className="chat-bubble-title">{item.title}</h4>
                            <p className="chat-bubble-summary">{item.summary}</p>
                          </>
                        ) : (
                          <span className="chat-bubble-text">{item.title}</span>
                        )}
                        
                        <div className="chat-bubble-footer">
                          {item.link && (
                            <a 
                              href={item.link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="chat-link"
                            >
                              <span>Read Full Article</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                          <span className="bubble-time">{formatMessageTime(item)}</span>
                        </div>
                      </motion.div>
                    </div>
                  ))}

                </React.Fragment>
              ))
            )}
            {/* Invisible div to target scroll */}
            <div ref={messagesEndRef} />
          </div>
        </section>

      </main>

    </div>
  );
}
