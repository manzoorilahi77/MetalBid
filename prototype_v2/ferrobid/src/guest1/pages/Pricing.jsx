import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, ShieldCheck, ShoppingCart, Megaphone, Globe, Smartphone, UserCheck, Palette, Video, ArrowRight } from 'lucide-react';
import '../styles/Pricing.css';

const Pricing = () => {
  const [volumeIndex, setVolumeIndex] = useState(6); // Default to ₹500M (Premium Plus)

  const handleSliderChange = (e) => {
    setVolumeIndex(parseInt(e.target.value));
  };

  // Determine highlighted plan based on volumeIndex
  let highlightCol = 3; // 1 = Essential, 2 = Premium, 3 = Premium Plus, 4 = Enterprise
  if (volumeIndex <= 2) highlightCol = 1;
  else if (volumeIndex <= 5) highlightCol = 2;
  else if (volumeIndex <= 7) highlightCol = 3;
  else highlightCol = 4;

  const sliderPercent = (volumeIndex / 8) * 100;

  return (
    <div className="pricing-page">
      {/* Header */}
      <section className="pricing-header-section">
        <div className="container text-center">
          <h1 className="pricing-title">Choose the plan that <span>fits your needs</span></h1>
          <p className="pricing-subtitle">Pricing is determined by your business size and features.<br/>Please select your expected volume below to see which plans are right for you.</p>
          
          <div className="volume-slider-container">
            <input 
              type="range" 
              min="0" 
              max="8" 
              step="1" 
              value={volumeIndex}
              onChange={handleSliderChange}
              className="volume-range"
              aria-label="Auction Volume"
              style={{
                background: `linear-gradient(to right, var(--primary) ${sliderPercent}%, #e7e1d8 ${sliderPercent}%)`
              }}
            />
            <div className="volume-labels">
              <span className={volumeIndex === 0 ? 'active' : ''}>&lt; ₹100K</span>
              <span className={volumeIndex === 1 ? 'active' : ''}>₹500K</span>
              <span className={volumeIndex === 2 ? 'active' : ''}>₹1M</span>
              <span className={volumeIndex === 3 ? 'active' : ''}>₹2M</span>
              <span className={volumeIndex === 4 ? 'active' : ''}>₹5M</span>
              <span className={volumeIndex === 5 ? 'active' : ''}>₹10M</span>
              <span className={volumeIndex === 6 ? 'active' : ''}>₹20M</span>
              <span className={volumeIndex === 7 ? 'active' : ''}>₹50M</span>
              <span className={volumeIndex === 8 ? 'active' : ''}>₹100M+</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <section className="pricing-table-section">
        <div className="container">
          <div className="table-swipe-hint">Swipe to compare all plans →</div>
          <div className="pricing-table-wrapper">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th className="feature-col">Compare Features</th>
                  <th className={`plan-col ${highlightCol === 1 ? 'highlight' : ''}`}>
                    <div className="plan-header" style={{position: 'relative'}}>
                      {highlightCol === 1 && <div className="recommended-badge">Recommended</div>}
                      <h3>Essential</h3>
                      <p>For small-scale auctions</p>
                      <div className="plan-price">
                        <span className="price-val">₹2,999</span>
                        <span className="price-period">/month</span>
                      </div>
                    </div>
                  </th>
                  <th className={`plan-col ${highlightCol === 2 ? 'highlight' : ''}`}>
                    <div className="plan-header" style={{position: 'relative'}}>
                      {highlightCol === 2 && <div className="recommended-badge">Recommended</div>}
                      <h3>Premium</h3>
                      <p>For mid-sized operations</p>
                      <div className="plan-price">
                        <span className="price-val">₹7,999</span>
                        <span className="price-period">/month</span>
                      </div>
                    </div>
                  </th>
                  <th className={`plan-col ${highlightCol === 3 ? 'highlight' : ''}`}>
                    <div className="plan-header" style={{position: 'relative'}}>
                      {highlightCol === 3 && <div className="recommended-badge">Recommended</div>}
                      <h3>Premium Plus</h3>
                      <p>For large-scale businesses</p>
                      <div className="plan-price">
                        <span className="price-val">₹14,999</span>
                        <span className="price-period">/month</span>
                      </div>
                    </div>
                  </th>
                  <th className={`plan-col ${highlightCol === 4 ? 'highlight' : ''}`}>
                    <div className="plan-header" style={{position: 'relative'}}>
                      {highlightCol === 4 && <div className="recommended-badge">Recommended</div>}
                      <h3>Enterprise</h3>
                      <p>For high-volume giants</p>
                      <div className="plan-price">
                        <span className="price-val">Custom</span>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className={highlightCol === 1 ? 'highlight-row' : ''}>
                  <td>Transaction Fee</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}>3%</td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}>2%</td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}>1%</td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}>0%</td>
                </tr>
                <tr>
                  <td>Auction Platform</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}>Unlimited</td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}>Unlimited</td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}>Exclusive</td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}>Unlimited</td>
                </tr>
                <tr>
                  <td>Staff Logins</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}>Up to 5</td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}>Up to 15</td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}>Up to 30</td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}>Unlimited</td>
                </tr>
                <tr>
                  <td>Auction & E-Commerce White Label Platform</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                </tr>
                <tr>
                  <td>Website Custom Domain</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                </tr>
                <tr>
                  <td>Inventory Management</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                </tr>
                <tr>
                  <td>Consignors & Consignment Management</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                </tr>
                <tr>
                  <td>Invoicing & Payments</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                </tr>
                <tr>
                  <td>Custom Branding</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                </tr>
                <tr>
                  <td>Shipping & Packing Scheduler</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                </tr>
                <tr>
                  <td>Dedicated Support Manager</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}><X className="x-icon" size={18} /></td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}><Check className="check-icon" size={18} /></td>
                </tr>
                <tr>
                  <td>API Access</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}><X className="x-icon" size={18} /></td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}><X className="x-icon" size={18} /></td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}>Up to 200,000 API calls</td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}>Custom</td>
                </tr>
                <tr>
                  <td>Transaction Emails</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}>Up to 1,000 /month</td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}>Up to 5,000 /month</td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}>Up to 20,000 /month</td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}>Custom</td>
                </tr>
                <tr>
                  <td>Email Campaigns</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}>Up to 500</td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}>Up to 2,000</td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}>Up to 10,000</td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}>Custom</td>
                </tr>
                <tr>
                  <td>SMS Notifications</td>
                  <td className={highlightCol === 1 ? 'highlight' : ''}>Up to 500</td>
                  <td className={highlightCol === 2 ? 'highlight' : ''}>Up to 1,000</td>
                  <td className={highlightCol === 3 ? 'highlight' : ''}>Up to 5,000</td>
                  <td className={highlightCol === 4 ? 'highlight' : ''}>Custom</td>
                </tr>
              </tbody>
            </table>
            <div className="table-footer-note">
              *Website customization and extra migration available upon request (additional charges may apply)
            </div>
          </div>
        </div>
      </section>

      {/* Add-ons Section */}
      <section className="addons-section">
        <div className="container">
          <div className="sec-head is-center">
            <p className="sec-eyebrow">Add-ons</p>
            <h2 className="sec-title">Improve your plan with add-ons</h2>
          </div>
          
          <div className="addons-grid">
            <div className="addon-card">
              <div className="addon-header">
                <div className="addon-icon"><ShieldCheck size={24} /></div>
                <div>
                  <h4>Verification & Fraud Detection</h4>
                  <div className="addon-price">₹499 <span>/ month</span></div>
                </div>
              </div>
              <ul className="addon-features">
                <li>Verify identity reliably via real-time global trusted checks</li>
                <li>Protect your auction house against fraudulent bidders and bad payers</li>
                <li>Ensure a fair auction environment with automated checks</li>
              </ul>
            </div>

            <div className="addon-card">
              <div className="addon-header">
                <div className="addon-icon"><ShoppingCart size={24} /></div>
                <div>
                  <h4>E-Commerce & Shopping Cart</h4>
                  <div className="addon-price">₹799 <span>/ month</span></div>
                </div>
              </div>
              <ul className="addon-features">
                <li>Sell items instantly with 'Buy Now' or 'Make an Offer' options</li>
                <li>Seamless integrated shopping cart for effortless checkout</li>
                <li>Transform window shoppers into real purchasers in a single click</li>
              </ul>
            </div>

            <div className="addon-card">
              <div className="addon-header">
                <div className="addon-icon"><Megaphone size={24} /></div>
                <div>
                  <h4>Marketing Campaign Tool</h4>
                  <div className="addon-price">₹999 <span>/ month</span></div>
                </div>
              </div>
              <ul className="addon-features">
                <li>Segment and target bidders based on behavior, interests, and past wins</li>
                <li>Launch automated email and SMS campaigns to maximize engagement</li>
                <li>Send unlimited communications to active contacts</li>
              </ul>
            </div>

            <div className="addon-card">
              <div className="addon-header">
                <div className="addon-icon"><Globe size={24} /></div>
                <div>
                  <h4>Custom Domain</h4>
                  <div className="addon-price">₹199 <span>/ month</span></div>
                </div>
              </div>
              <ul className="addon-features">
                <li>Run auctions directly from your own distinct website URL</li>
                <li>Maintain a cohesive brand experience from start to finish</li>
                <li>Boost your SEO by keeping all traffic on your own domain</li>
              </ul>
            </div>
            
            <div className="addon-card">
              <div className="addon-header">
                <div className="addon-icon"><Palette size={24} /></div>
                <div>
                  <h4>Premium Design Package</h4>
                  <div className="addon-price">₹2,499 <span>/ month</span></div>
                </div>
              </div>
              <ul className="addon-features">
                <li>Elevate your brand with highly customized visual templates</li>
                <li>Advanced custom CSS and layouts tailored specifically to your guidelines</li>
                <li>Priority access to our design team for custom banners and landing pages</li>
              </ul>
            </div>
            
            <div className="addon-card">
              <div className="addon-header">
                <div className="addon-icon"><Video size={24} /></div>
                <div>
                  <h4>Live Auction Studio</h4>
                  <div className="addon-price">₹3,999 <span>/ month</span></div>
                </div>
              </div>
              <ul className="addon-features">
                <li>High-definition video and audio streaming directly from the auction floor</li>
                <li>Integrated clerk controls for real-time bid capturing</li>
                <li>Bring the excitement of a live room to online bidders anywhere</li>
              </ul>
            </div>
            
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="pricing-cta-section">
        <div className="container text-center">
          <p className="cta-kicker">GET STARTED TODAY</p>
          <h2 className="cta-heading">Your next auction deserves<br/><span>Better software.</span></h2>
          <div className="cta-actions">
            <button className="btn btn-primary" style={{borderRadius: '24px', padding: '12px 32px'}}>
              Get A Free Demo <ArrowRight size={16} className="ml-2" />
            </button>
            <button className="btn btn-outline" style={{borderRadius: '24px', padding: '12px 32px'}}>
              Talk to Sales
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
