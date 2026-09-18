import React, { useState, useEffect } from 'react';
import { Radio, Activity, Database, Server, Wifi } from 'lucide-react';

export default function LoRaReceiver() {
  const [radioPackets, setRadioPackets] = useState(() => {
    const saved = localStorage.getItem('lora_logs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('lora_logs', JSON.stringify(radioPackets));
  }, [radioPackets]);

  useEffect(() => {
    const radioChannel = new BroadcastChannel('lora_radio');
    radioChannel.onmessage = (event) => {
      setRadioPackets(prev => {
        // Prevent duplicate logs if multiple tabs are open and receiving
        const isDuplicate = prev.some(p => p.id === event.data.id && p.ts === event.data.ts);
        if (isDuplicate) return prev;
        return [{ ...event.data, _receivedAt: new Date().toISOString() }, ...prev];
      });
    };
    return () => radioChannel.close();
  }, []);

  const handleClearLogs = () => {
    setRadioPackets([]);
    localStorage.removeItem('lora_logs');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#10b981', fontFamily: 'monospace', padding: '24px' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(16,185,129,0.3)', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Radio size={32} color="#10b981" />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gateway Receiver</h1>
            <div style={{ fontSize: '0.85rem', color: '#059669' }}>Frequency: 868.0 MHz (LoRaWAN)</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
          <button onClick={handleClearLogs} style={{ background: 'transparent', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '0 16px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>
            CLEAR LOGS
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.1)', padding: '8px 16px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Server size={16} /> <span>Status: ONLINE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.1)', padding: '8px 16px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Activity size={16} /> <span>Packets: {radioPackets.length}</span>
          </div>
        </div>
      </header>

      <main>
        {radioPackets.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#059669' }}>
            <Wifi size={64} style={{ opacity: 0.5, marginBottom: '24px', animation: 'pulse 2s infinite' }} />
            <h2 style={{ letterSpacing: '0.1em' }}>AWAITING TRANSMISSION...</h2>
            <p style={{ opacity: 0.7 }}>Monitoring channel for incoming packets.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
            {radioPackets.map((pkt, idx) => (
              <div key={idx} style={{ 
                background: 'rgba(16,185,129,0.05)', 
                border: '1px solid rgba(16,185,129,0.4)', 
                borderRadius: '8px', 
                padding: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(16,185,129,0.3)', paddingBottom: '8px', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 'bold' }}>[PKT-{String(radioPackets.length - idx).padStart(4, '0')}]</span>
                  <span>{new Date(pkt._receivedAt).toLocaleTimeString()}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '0.9rem', marginBottom: '16px' }}>
                  <div style={{ opacity: 0.7 }}>Type:</div>
                  <div style={{ fontWeight: 'bold', color: '#6ee7b7' }}>{pkt.type.toUpperCase()}</div>
                  
                  <div style={{ opacity: 0.7 }}>Identifier:</div>
                  <div>{pkt.name || pkt.id}</div>
                  
                  <div style={{ opacity: 0.7 }}>Signal (RSSI):</div>
                  <div>-{Math.floor(Math.random() * 20) + 70} dBm</div>
                </div>
                
                <div style={{ background: '#000', padding: '12px', borderRadius: '4px', border: '1px solid #1e293b' }}>
                  <div style={{ opacity: 0.5, fontSize: '0.75rem', marginBottom: '8px' }}>RAW PAYLOAD:</div>
                  <pre style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(pkt, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.3; transform: scale(0.95); }
          50% { opacity: 0.7; transform: scale(1.05); }
          100% { opacity: 0.3; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}
