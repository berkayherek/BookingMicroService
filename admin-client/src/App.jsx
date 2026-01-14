import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './Login';

// Setup API
// If you are local, use localhost:5001. If cloud, use env var.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5001';
const api = axios.create({ baseURL: GATEWAY_URL });

// If using gateway locally, uncomment this line instead:
// const api = axios.create({ baseURL: '/api' }); 

function App() {
  const [token, setToken] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hotels, setHotels] = useState([]);
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false); // NEW: Schedule Modal
  const [isEditing, setIsEditing] = useState(false);

  // Data
  const [currentHotel, setCurrentHotel] = useState(null); // Which hotel are we viewing?
  const [bookings, setBookings] = useState([]); // List of bookings for the modal
  const [stats, setStats] = useState({ totalHotels: 0, totalRooms: 0, totalRevenue: 0 });

  // Forms
  const [formData, setFormData] = useState({
    id: '', name: '', location: '', exactLocation: '', description: '', basePrice: '', rooms: [] 
  });
  const [tempRoom, setTempRoom] = useState({
    type: 'Standard', capacity: 2, price: 100, count: 10, amenities: ''
  });

  useEffect(() => {
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const hRes = await api.get('/admin/hotels'); 
      setHotels(hRes.data);
      calculateStats(hRes.data);
    } catch (err) { console.error("API Error", err); }
  };

  const calculateStats = (data) => {
    let rooms = 0;
    data.forEach(h => {
        if(h.rooms) h.rooms.forEach(r => rooms += Number(r.count));
    });
    setStats({
        totalHotels: data.length,
        totalRooms: rooms,
        totalRevenue: 12500 + (data.length * 450) 
    });
  };

  // --- NEW: FETCH BOOKINGS ---
  const handleViewSchedule = async (hotel) => {
      setCurrentHotel(hotel);
      setBookings([]); // Clear old data
      setShowScheduleModal(true);
      try {
          // Call the new backend endpoint
          const res = await api.get(`/admin/bookings?hotelId=${hotel.id}`);
          setBookings(res.data);
      } catch (e) {
          alert("Could not load bookings. Make sure backend is updated!");
      }
  };

  // --- FORM HANDLERS ---
  const openCreateModal = () => {
      setFormData({ id: '', name: '', location: '', exactLocation: '', description: '', basePrice: '', rooms: [] });
      setIsEditing(false);
      setShowModal(true);
  };

  const openEditModal = (hotel) => {
      setFormData({
          id: hotel.id,
          name: hotel.name,
          location: hotel.location,
          exactLocation: hotel.exactLocation || '',
          description: hotel.description || '',
          basePrice: hotel.basePrice,
          rooms: hotel.rooms || []
      });
      setIsEditing(true);
      setShowModal(true);
  };

  const addRoomToForm = (e) => {
    e.preventDefault();
    if(!tempRoom.type) return alert("Room type required");
    const roomToAdd = {
        ...tempRoom,
        price: Number(tempRoom.price),
        capacity: Number(tempRoom.capacity),
        count: Number(tempRoom.count),
        amenities: tempRoom.amenities ? tempRoom.amenities.split(',').map(s=>s.trim()) : []
    };
    setFormData({ ...formData, rooms: [...formData.rooms, roomToAdd] });
    setTempRoom({ type: '', capacity: 2, price: 100, count: 10, amenities: '' }); 
  };

  const removeRoom = (index) => {
      const updatedRooms = formData.rooms.filter((_, i) => i !== index);
      setFormData({ ...formData, rooms: updatedRooms });
  };

  const updateRoomField = (index, field, value) => {
      const updatedRooms = [...formData.rooms];
      updatedRooms[index][field] = value;
      setFormData({ ...formData, rooms: updatedRooms });
  };

  const handleSave = async () => {
    try {
        const payload = { ...formData, basePrice: Number(formData.basePrice) };
        if (isEditing) {
            await api.put(`/admin/hotels/${formData.id}`, payload);
            alert("✅ Hotel Updated!");
        } else {
            await api.post('/admin/hotels', payload);
            alert("✅ Hotel Created!");
        }
        setShowModal(false);
        fetchData();
    } catch (err) { alert("Failed to save"); }
  };

  if (!token) return <Login onLogin={setToken} />;

  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>Admin<span style={{color:'#3498db'}}>Portal</span></div>
        <nav style={styles.nav}>
            <button style={activeTab === 'dashboard' ? styles.navItemActive : styles.navItem} onClick={()=>setActiveTab('dashboard')}>📊 Dashboard</button>
            <button style={activeTab === 'inventory' ? styles.navItemActive : styles.navItem} onClick={()=>setActiveTab('inventory')}>🏨 Inventory</button>
            <button style={styles.navItem} onClick={() => setToken(null)}>🚪 Logout</button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main style={styles.main}>
        <header style={styles.header}>
            <h2 style={{margin:0}}>{activeTab === 'dashboard' ? 'Overview' : 'Hotel Management'}</h2>
            {activeTab === 'inventory' && (
                <button onClick={openCreateModal} style={styles.primaryBtn}>+ Add Property</button>
            )}
        </header>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
            <div style={styles.grid}>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Total Hotels</div>
                    <div style={styles.cardValue}>{stats.totalHotels}</div>
                </div>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Total Capacity</div>
                    <div style={styles.cardValue}>{stats.totalRooms} <span style={{fontSize:'14px', color:'#7f8c8d'}}>rooms</span></div>
                </div>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Monthly Revenue</div>
                    <div style={{...styles.cardValue, color:'#27ae60'}}>${stats.totalRevenue.toLocaleString()}</div>
                </div>
            </div>
        )}

        {/* INVENTORY TABLE */}
        {activeTab === 'inventory' && (
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr style={{background:'#f8f9fa', textAlign:'left'}}>
                            <th style={styles.th}>Hotel Name</th>
                            <th style={styles.th}>Location</th>
                            <th style={styles.th}>Room Summary</th>
                            <th style={styles.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {hotels.map(h => (
                            <tr key={h.id} style={{borderBottom:'1px solid #eee'}}>
                                <td style={styles.td}><b>{h.name}</b></td>
                                <td style={styles.td}>{h.location}</td>
                                <td style={styles.td}>
                                    {h.rooms?.map((r,i) => (
                                        <div key={i} style={{fontSize:'12px', color:'#555'}}>
                                            {r.type}: <b>{r.count}</b> units
                                        </div>
                                    ))}
                                </td>
                                <td style={styles.td}>
                                    <div style={{display:'flex', gap:'10px'}}>
                                        {/* NEW SCHEDULE BUTTON */}
                                        <button onClick={() => handleViewSchedule(h)} style={styles.altBtn}>📅 Schedule</button>
                                        <button onClick={() => openEditModal(h)} style={styles.smBtn}>✏️ Edit</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </main>

      {/* EDIT/CREATE MODAL */}
      {showModal && (
        <div style={styles.modalOverlay}>
            <div style={styles.modal}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                    <h3>{isEditing ? '✏️ Edit Property' : '➕ Add New Property'}</h3>
                    <button onClick={()=>setShowModal(false)} style={styles.closeBtn}>×</button>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', maxHeight:'70vh', overflowY:'auto'}}>
                    <div>
                        <label style={styles.label}>Basic Info</label>
                        <input style={styles.input} placeholder="Hotel Name" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                        <input style={styles.input} placeholder="City" value={formData.location} onChange={e=>setFormData({...formData, location:e.target.value})} />
                        <input style={styles.input} placeholder="Address" value={formData.exactLocation} onChange={e=>setFormData({...formData, exactLocation:e.target.value})} />
                        <input style={styles.input} type="number" placeholder="Base Price" value={formData.basePrice} onChange={e=>setFormData({...formData, basePrice:e.target.value})} />
                        <textarea style={{...styles.input, height:'60px'}} placeholder="Description" value={formData.description} onChange={e=>setFormData({...formData, description:e.target.value})} />
                    </div>
                    <div style={{background:'#f8f9fa', padding:'15px', borderRadius:'8px'}}>
                        <h4 style={{marginTop:0}}>Manage Rooms</h4>
                        <div style={{marginBottom:'15px'}}>
                            {formData.rooms.map((r, i) => (
                                <div key={i} style={{display:'flex', gap:'5px', marginBottom:'5px', alignItems:'center'}}>
                                    <div style={{flex:1, fontWeight:'bold', fontSize:'13px'}}>{r.type}</div>
                                    <input type="number" style={{width:'40px'}} value={r.price} onChange={(e) => updateRoomField(i, 'price', Number(e.target.value))} />
                                    <input type="number" style={{width:'40px'}} value={r.count} onChange={(e) => updateRoomField(i, 'count', Number(e.target.value))} />
                                    <button onClick={() => removeRoom(i)} style={{color:'red', border:'none'}}>×</button>
                                </div>
                            ))}
                        </div>
                        <input style={styles.input} placeholder="Type" value={tempRoom.type} onChange={e=>setTempRoom({...tempRoom, type:e.target.value})} />
                        <button onClick={addRoomToForm} style={styles.secondaryBtn}>+ Add Room</button>
                    </div>
                </div>
                <div style={{marginTop:'20px', textAlign:'right'}}>
                    <button onClick={handleSave} style={styles.primaryBtn}>Save Changes</button>
                </div>
            </div>
        </div>
      )}

      {/* NEW: SCHEDULE MODAL */}
      {showScheduleModal && (
        <div style={styles.modalOverlay}>
            <div style={styles.modal}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                    <h3>📅 Bookings for {currentHotel?.name}</h3>
                    <button onClick={()=>setShowScheduleModal(false)} style={styles.closeBtn}>×</button>
                </div>
                
                <div style={{maxHeight:'60vh', overflowY:'auto'}}>
                    {bookings.length === 0 ? (
                        <p style={{color:'#666', fontStyle:'italic'}}>No active bookings found.</p>
                    ) : (
                        <table style={styles.table}>
                            <thead>
                                <tr style={{background:'#eee', fontSize:'12px'}}>
                                    <th style={{padding:'8px'}}>Room</th>
                                    <th style={{padding:'8px'}}>Guest</th>
                                    <th style={{padding:'8px'}}>Check-In</th>
                                    <th style={{padding:'8px'}}>Check-Out</th>
                                    <th style={{padding:'8px'}}>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map(b => (
                                    <tr key={b.id} style={{borderBottom:'1px solid #eee', fontSize:'13px'}}>
                                        <td style={{padding:'8px'}}><b>{b.roomType}</b></td>
                                        <td style={{padding:'8px'}}>{b.userId}</td>
                                        <td style={{padding:'8px', color:'#27ae60'}}>{b.startDate}</td>
                                        <td style={{padding:'8px', color:'#c0392b'}}>{b.endDate}</td>
                                        <td style={{padding:'8px'}}>${b.totalPrice}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

const styles = {
    container: { display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', Roboto, sans-serif", background: '#f0f2f5' },
    sidebar: { width: '250px', background: '#1a202c', color: 'white', display: 'flex', flexDirection: 'column' },
    brand: { padding: '20px', fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid #2d3748' },
    nav: { padding: '20px 0' },
    navItem: { display: 'block', width: '100%', padding: '15px 20px', background: 'transparent', color: '#cbd5e0', border: 'none', borderLeft: '4px solid transparent', textAlign: 'left', cursor: 'pointer', fontSize: '15px' },
    navItemActive: { display: 'block', width: '100%', padding: '15px 20px', background: '#2d3748', color: 'white', border: 'none', borderLeft: '4px solid #3498db', textAlign: 'left', cursor: 'pointer', fontSize: '15px' },
    main: { flex: 1, padding: '30px', overflowY: 'auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' },
    card: { background: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    cardTitle: { color: '#7f8c8d', fontSize: '14px', textTransform: 'uppercase', fontWeight: '600' },
    cardValue: { fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#2c3e50' },
    tableContainer: { background: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '15px', color: '#7f8c8d', fontSize: '13px', fontWeight: '600', borderBottom: '1px solid #eee' },
    td: { padding: '15px', fontSize: '14px', color: '#2c3e50', verticalAlign:'middle' },
    primaryBtn: { background: '#3498db', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' },
    secondaryBtn: { background: '#e2e8f0', color: '#2d3748', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', width:'100%', fontSize:'12px', fontWeight:'bold' },
    smBtn: { background: 'white', color: '#3498db', border: '1px solid #3498db', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize:'12px', fontWeight:'bold' },
    altBtn: { background: 'white', color: '#e67e22', border: '1px solid #e67e22', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize:'12px', fontWeight:'bold' },
    closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' },
    label: { display:'block', fontSize:'12px', fontWeight:'bold', marginBottom:'5px', color:'#555'},
    input: { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', boxSizing:'border-box', fontSize:'13px' },
    badgeSuccess: { background: '#def7ec', color: '#03543f', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal: { background: 'white', width: '700px', padding: '30px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }
};

export default App;