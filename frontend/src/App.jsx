import React, { useState, useEffect } from 'react';
import { hotelService } from './api';
import Login from './Login';

// --- INTERNAL COMPONENT: MAP MODAL ---
// (Included here for single-file convenience)
const MapModal = ({ location, onClose }) => {
  if (!location) return null;
  // Google Maps Embed (No API Key required for basic view)
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(location)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

  return (
    <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', zIndex: 2000,
        display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
          background: 'white', padding: '20px', borderRadius: '10px',
          width: '600px', maxWidth: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
            <h3 style={{margin: 0}}>📍 {location}</h3>
            <button onClick={onClose} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer'}}>×</button>
        </div>
        <div style={{borderRadius: '8px', overflow: 'hidden', background: '#eee', height: '400px'}}>
            <iframe 
                width="100%" height="100%" src={mapUrl} 
                frameBorder="0" scrolling="no" title="Location Map"
            ></iframe>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
const App = () => {
  // --- State ---
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [myBookings, setMyBookings] = useState([]);

  const [loading, setLoading] = useState(false);
  const [hotels, setHotels] = useState([]);
  
  // Search State
  const [destination, setDestination] = useState('');
  
  // Map State
  const [selectedMapLocation, setSelectedMapLocation] = useState(null);
  
  // DATE LOGIC: Default CheckIn = Today, CheckOut = Tomorrow
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(1);
  
  // Pricing State: { hotelId: { predictedPrice, reason } }
  const [basePredictions, setBasePredictions] = useState({}); 

  // --- Auth ---
  const handleLogin = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    hotelService.setToken(newToken, userData);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    hotelService.setToken(null, null);
    setMyBookings([]);
  };

  // --- Actions ---
  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setHotels([]);
    try {
      const res = await hotelService.search(destination);
      setHotels(res.data);
    } catch (err) { alert("Search failed"); } 
    finally { setLoading(false); }
  };

  const loadHistory = async () => {
    try {
        const res = await hotelService.getMyBookings();
        setMyBookings(res.data);
        setShowHistory(true);
    } catch(e) { alert("Could not load history"); }
  };

  // --- ML Pricing Logic ---
  useEffect(() => {
    if (hotels.length === 0 || !checkIn) return;
    
    const fetchPrices = async () => {
        const newPreds = {};
        await Promise.all(hotels.map(async (h) => {
            try {
                // Predict based on CheckIn date
                const res = await hotelService.predictPrice(h.basePrice, checkIn, 'Standard');
                newPreds[h.id] = res.data;
            } catch(e) {
                newPreds[h.id] = { predictedPrice: h.basePrice, reason: 'Standard' };
            }
        }));
        setBasePredictions(newPreds);
    };
    fetchPrices();
  }, [hotels, checkIn]); 

  // --- HELPER: Calculate Nights ---
  const calculateNights = () => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (end <= start) return 0;
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  // --- Helper to Calculate Final Price ---
  const getFinalPrice = (hotelId, roomPrice) => {
    const nights = calculateNights();
    if (nights <= 0) return { total: 0, error: "Invalid Dates" };

    const mlData = basePredictions[hotelId];
    
    // 1. Get ML Multiplier
    let multiplier = 1;
    if (mlData && mlData.predictedPrice && mlData.multiplier) {
        multiplier = mlData.multiplier;
    } else if (mlData && mlData.predictedPrice) {
         const hotel = hotels.find(h => h.id === hotelId);
         if(hotel && hotel.basePrice > 0) multiplier = mlData.predictedPrice / hotel.basePrice;
    }

    // 2. Apply Seasonality & Guests & Nights
    let total = (roomPrice * multiplier * guests) * nights;

    // 3. Apply Member Discount (10%)
    let isDiscounted = false;
    let oldPrice = total;
    if (token) {
        total = total * 0.90;
        isDiscounted = true;
    }

    return { 
        total: Math.round(total), 
        oldPrice: Math.round(oldPrice), 
        isDiscounted, 
        reason: mlData?.reason,
        nights: nights
    };
  };

  // --- Booking ---
  const handleBook = async (hotel, room) => {
    if (!token) return alert("Please Login to Book");
    
    const priceInfo = getFinalPrice(hotel.id, room.price);
    if (priceInfo.error) return alert("Check-Out date must be after Check-In date.");

    if(!confirm(`Book ${room.type}?\nDuration: ${priceInfo.nights} Nights\nTotal: $${priceInfo.total}\nDates: ${checkIn} to ${checkOut}`)) return;

    try {
        await hotelService.book({
            hotelId: hotel.id,
            roomType: room.type,
            startDate: checkIn,
            endDate: checkOut,
            guestCount: Number(guests),
            totalPrice: priceInfo.total
        });
        alert("✅ Booking Successful!");
        handleSearch({preventDefault:()=>{}}); // Refresh inventory
    } catch (err) {
        alert("Booking Failed: " + (err.response?.data?.error || err.message));
    }
  };

  if (!token) return <Login onLogin={handleLogin} />;

  return (
    <div style={{fontFamily:'sans-serif', background:'#f4f6f8', minHeight:'100vh'}}>
      {/* Header */}
      <header style={{background:'#003580', color:'white', padding:'15px', display:'flex', justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>BookingClone</h2>
        <div>
            <span style={{marginRight:'15px'}}>Welcome, {user}</span>
            <button onClick={loadHistory} style={{marginRight:'10px', background:'none', border:'1px solid white', color:'white', padding:'5px 10px', cursor:'pointer'}}>My Reservations</button>
            <button onClick={handleLogout} style={{background:'#d9534f', border:'none', color:'white', padding:'5px 10px', cursor:'pointer'}}>Logout</button>
        </div>
      </header>

      {/* Search Bar */}
      <div style={{background:'#003580', padding:'20px', display:'flex', justifyContent:'center', gap:'10px', alignItems:'flex-end'}}>
        <div>
            <label style={{color:'white', display:'block', fontSize:'12px'}}>Location</label>
            <input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Bodrum" style={{padding:'8px'}} />
        </div>
        <div>
            <label style={{color:'white', display:'block', fontSize:'12px'}}>Check-In</label>
            <input type="date" value={checkIn} onChange={e=>setCheckIn(e.target.value)} style={{padding:'8px'}} />
        </div>
        <div>
            <label style={{color:'white', display:'block', fontSize:'12px'}}>Check-Out</label>
            <input type="date" value={checkOut} onChange={e=>setCheckOut(e.target.value)} style={{padding:'8px'}} />
        </div>
        <div>
            <label style={{color:'white', display:'block', fontSize:'12px'}}>Guests</label>
            <input type="number" min="1" value={guests} onChange={e=>setGuests(e.target.value)} style={{padding:'8px', width:'60px'}} />
        </div>
        <button onClick={handleSearch} style={{padding:'10px 20px', background:'#0071c2', color:'white', border:'none', cursor:'pointer', fontWeight:'bold'}}>Search</button>
      </div>

      {/* Results */}
      <div style={{maxWidth:'1000px', margin:'20px auto', padding:'20px'}}>
        {loading && <p>Loading...</p>}
        {hotels.map(h => (
            <div key={h.id} style={{background:'white', marginBottom:'20px', borderRadius:'8px', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.1)', display:'flex'}}>
                <div style={{width:'250px', background:'#ddd'}}>
                    <img src="https://via.placeholder.com/250x200" style={{objectFit:'cover', height:'100%'}} alt="hotel" />
                </div>
                <div style={{padding:'20px', flex:1}}>
                    {/* HOTEL HEADER & MAP BUTTON */}
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                        <div>
                            <h3 style={{margin:'0 0 5px 0', color:'#0071c2'}}>{h.name}</h3>
                            <p style={{fontSize:'14px', color:'#666', margin:0}}>{h.location} • {h.exactLocation}</p>
                        </div>
                        <button 
                            onClick={() => setSelectedMapLocation(h.exactLocation || h.location)}
                            style={{
                                background: 'white', border: '1px solid #0071c2', 
                                color: '#0071c2', padding: '5px 10px', 
                                borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
                                display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                        >
                            📍 Haritada Göster
                        </button>
                    </div>

                    <p style={{fontSize:'13px', marginTop:'10px'}}>{h.description}</p>
                    
                    <div style={{marginTop:'15px', borderTop:'1px solid #eee', paddingTop:'10px'}}>
                        <h5 style={{margin:'0 0 10px 0'}}>Available Rooms:</h5>
                        {h.rooms && h.rooms.map((room, i) => {
                            const pricing = getFinalPrice(h.id, room.price);
                            return (
                                <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f9f9f9', padding:'10px', marginBottom:'5px', borderRadius:'4px'}}>
                                    <div>
                                        <div style={{fontWeight:'bold'}}>{room.type}</div>
                                        <div style={{fontSize:'12px', color:'#555'}}>{room.amenities.join(', ')}</div>
                                        {room.count < 3 && <div style={{color:'red', fontSize:'11px', fontWeight:'bold'}}>Only {room.count} left!</div>}
                                    </div>
                                    <div style={{textAlign:'right'}}>
                                        {pricing.error ? (
                                            <span style={{color:'red', fontSize:'12px'}}>Invalid Dates</span>
                                        ) : (
                                            <>
                                                {pricing.isDiscounted && (
                                                    <div style={{textDecoration:'line-through', color:'#999', fontSize:'13px'}}>${pricing.oldPrice}</div>
                                                )}
                                                <div style={{color:'#d32f2f', fontWeight:'bold', fontSize:'18px'}}>
                                                    ${pricing.total}
                                                </div>
                                                <div style={{fontSize:'11px', color:'#008009'}}>{pricing.reason}</div>
                                                <div style={{fontSize:'10px', color:'#666'}}>
                                                    {guests} guest(s), {pricing.nights} night(s)
                                                </div>
                                                <button 
                                                    disabled={room.count <= 0}
                                                    onClick={() => handleBook(h, room)}
                                                    style={{marginTop:'5px', background: room.count > 0 ? '#0071c2' : '#ccc', color:'white', border:'none', padding:'5px 15px', borderRadius:'4px', cursor: room.count > 0 ? 'pointer' : 'not-allowed'}}
                                                >
                                                    {room.count > 0 ? 'Reserve' : 'Sold Out'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        ))}
      </div>

      {/* History Modal */}
      {showHistory && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center'}}>
            <div style={{background:'white', padding:'30px', borderRadius:'8px', width:'500px', maxHeight:'80vh', overflowY:'auto'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                    <h3>My Reservations</h3>
                    <button onClick={()=>setShowHistory(false)}>Close</button>
                </div>
                {myBookings.length === 0 ? <p>No bookings found.</p> : (
                    <div>
                        {myBookings.map(b => (
                            <div key={b.id} style={{borderBottom:'1px solid #eee', padding:'10px 0'}}>
                                <b>{b.hotelName}</b> <span style={{fontSize:'12px', background:'#eee', padding:'2px 6px', borderRadius:'4px'}}>{b.roomType}</span><br/>
                                Dates: {b.startDate} to {b.endDate || b.date}<br/>
                                Total Paid: <b>${b.totalPrice}</b>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Map Modal */}
      {selectedMapLocation && (
          <MapModal location={selectedMapLocation} onClose={() => setSelectedMapLocation(null)} />
      )}
    </div>
  );
};

export default App;