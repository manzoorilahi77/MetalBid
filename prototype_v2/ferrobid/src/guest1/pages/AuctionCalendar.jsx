import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, MapPin, Building2, Calendar, Phone, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to get dates
const getDaysArray = (startDate, numDays) => {
  const days = [];
  const start = new Date(startDate);
  for (let i = 0; i < numDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({
      dateObj: d,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      day: d.toLocaleDateString('en-US', { weekday: 'long' }),
      dateKey: d.toISOString().split('T')[0], // yyyy-mm-dd
      isToday: new Date().toDateString() === d.toDateString()
    });
  }
  return days;
};

const AuctionCalendar = () => {
  const [weekOffset, setWeekOffset] = useState(0); // in days (or blocks)
  const [direction, setDirection] = useState(1); // 1 for right, -1 for left
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Track window size for responsive grid days
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const numDaysToShow = isMobile ? 3 : 7;
  
  // Base date is "today" plus the offset
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset);
  
  const currentDates = getDaysArray(baseDate, numDaysToShow);
  const dateRangeStr = `${currentDates[0].label} - ${currentDates[currentDates.length - 1].label}, ${currentDates[0].dateObj.getFullYear()}`;

  // We set initial selected slot to the first day 11:00 AM
  const [selectedSlot, setSelectedSlot] = useState({ 
    dateObj: currentDates[0].dateObj, 
    label: currentDates[0].label, 
    time: '11:00' 
  });

  const hours = [
    '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00', 
    '17:00', '18:00'
  ];

  // Mock data generator for slots based on dateKey + time
  const getSlotCount = (dateKey, time) => {
    // deterministic pseudo-random count based on string sum to keep data consistent when switching weeks
    const hash = (dateKey + time).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    if (hash % 5 === 0) return (hash % 15) + 1;
    if (hash % 7 === 0) return (hash % 5) + 1;
    return 0; // empty slot
  };

  const handleSlotClick = (dateItem, time) => {
    setSelectedSlot({ dateObj: dateItem.dateObj, label: dateItem.label, time });
  };

  const navigateDays = (step) => {
    setDirection(step > 0 ? 1 : -1);
    setWeekOffset(prev => prev + (step * numDaysToShow));
  };

  const goToday = () => {
    setDirection(weekOffset > 0 ? -1 : 1);
    setWeekOffset(0);
  };

  // Grid swipe animation variants
  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir < 0 ? 50 : -50, opacity: 0 }),
  };

  return (
    <div className="calendar-page-container">
      {/* Header Section */}
      <div className="calendar-header-wrapper">
        <div className="container">
          <div className="calendar-top-bar">
            <div className="calendar-top-left">
              <h1 className="calendar-page-title">Auction Calendar</h1>
              <div className="filter-group">
                <div className="input-with-icon">
                  <Search size={16} className="input-icon" />
                  <input type="text" placeholder="Product Search" aria-label="Product Search" className="calendar-input" />
                </div>
                
                <div className="select-wrapper">
                  <Building2 size={16} className="select-icon" />
                  <select className="calendar-select" aria-label="Seller">
                    <option value="">Seller</option>
                    <option value="tata">Tata Steel</option>
                    <option value="sail">SAIL</option>
                  </select>
                </div>
                
                <div className="select-wrapper">
                  <MapPin size={16} className="select-icon" />
                  <select className="calendar-select" aria-label="Location">
                    <option value="">Location</option>
                    <option value="east">East India</option>
                    <option value="west">West India</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="container">
        <div className="calendar-layout">
          
          {/* Calendar Grid Area */}
          <div className="calendar-matrix-wrapper">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div 
                key={weekOffset}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="calendar-matrix"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `80px repeat(${numDaysToShow}, 1fr)`
                }}
              >
                {/* Header Row */}
                <div className="matrix-corner" style={{ gridColumn: 1, gridRow: 1, borderRight: '1px solid #e7e1d8', borderBottom: '2px solid #e7e1d8', background: '#f3efe9' }}></div>
                {currentDates.map((d, i) => (
                  <div key={i} className={`matrix-date-col ${d.isToday ? 'active-col' : ''}`} style={{ gridColumn: i + 2, gridRow: 1, borderBottom: '2px solid #e7e1d8', background: '#f3efe9' }}>
                    <div className="date-num">{d.label}</div>
                    <div className="date-day">{d.day}</div>
                  </div>
                ))}
                
                {/* Grid Rows */}
                {hours.map((hour, hIndex) => (
                  <React.Fragment key={hIndex}>
                    <div className="matrix-time-col" style={{ gridColumn: 1, gridRow: hIndex + 2 }}>{hour}</div>
                    {currentDates.map((d, dIndex) => {
                      const count = getSlotCount(d.dateKey, hour);
                      const isSelected = selectedSlot.label === d.label && selectedSlot.time === hour;
                      
                      return (
                        <motion.div 
                          key={dIndex} 
                          className={`matrix-slot ${count > 0 ? 'has-events' : ''} ${isSelected ? 'selected-slot' : ''} ${d.isToday ? 'active-column-bg' : ''}`}
                          style={{ gridColumn: dIndex + 2, gridRow: hIndex + 2 }}
                          onClick={() => count > 0 && handleSlotClick(d, hour)}
                          whileHover={count > 0 ? { scale: 1.05, zIndex: 10, position: 'relative' } : {}}
                        >
                          {count > 0 && (
                            <motion.div 
                              className="slot-badge"
                            >
                              {count}
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </motion.div>
            </AnimatePresence>
            <div className="calendar-disclaimer">
              *Auction schedule can be subjected to change.
            </div>
          </div>
          
          {/* Sidebar / Details Area */}
          <div className="calendar-sidebar">
            <div className="date-navigator" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <button className="nav-today" onClick={goToday}>Today</button>
              <button className="nav-btn" aria-label="Previous week" onClick={() => navigateDays(-1)}><ChevronLeft size={18} /></button>
              <span className="current-date-range">{dateRangeStr}</span>
              <button className="nav-btn" aria-label="Next week" onClick={() => navigateDays(1)}><ChevronRight size={18} /></button>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div 
                key={`${selectedSlot.label}-${selectedSlot.time}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="calendar-sidebar-animator"
              >
                <h2 className="sidebar-title">
                  {selectedSlot.label} {selectedSlot.dateObj.toLocaleDateString('en-US', { weekday: 'long' })} {selectedSlot.time}
                </h2>
                
                <div className="auction-cards-list">
                  {/* Generate some fake mock cards based on slot hash so it looks real */}
                  {Array.from({ length: getSlotCount(selectedSlot.dateObj.toISOString().split('T')[0], selectedSlot.time) || 1 }).slice(0, 3).map((_, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="calendar-auction-card"
                    >
                      <div className="card-header-id">FA - {Math.floor(Math.random() * 1000000) + 1000000}</div>
                      <div className="card-seller-name">{i % 2 === 0 ? 'SAIL-BSP . 1 Lots' : 'TATA Steel Industrial By-Products Management Division...'}</div>
                      <div className="card-badges">
                        <span className="mat-badge">{i % 2 === 0 ? 'IRON ORE' : 'HR COIL'}</span>
                        {i % 2 !== 0 && <span className="mat-badge">HR PLATE</span>}
                        <span className="mat-badge plus">+1</span>
                      </div>
                    </motion.div>
                  ))}
                  {getSlotCount(selectedSlot.dateObj.toISOString().split('T')[0], selectedSlot.time) === 0 && (
                    <div className="calendar-auction-card empty-card">
                      <p style={{ margin: 0, color: 'var(--text-muted)' }}>No auctions scheduled for this block.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default AuctionCalendar;
