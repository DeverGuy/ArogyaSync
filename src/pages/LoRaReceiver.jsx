import React, { useState, useEffect, useRef } from 'react';
import { Radio, ShieldAlert, Cpu, CheckCircle2, RotateCcw, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PacketCard = ({ pkt }) => {
  const [decompressed, setDecompressed] = useState(false);

  useEffect(() => {
    // Simulate decompression/decryption delay
    const timer = setTimeout(() => setDecompressed(true), 1200 + Math.random() * 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 bg-[#FBFBFA] border border-[#EAEAEA] rounded-md"
    >
      <div className="flex justify-between items-start mb-3 border-b border-[#EAEAEA] pb-2 text-xs font-bold uppercase tracking-widest text-[#787774]">
        <span>[RX] {new Date(pkt._receivedAt).toLocaleTimeString()}</span>
        <div className="flex items-center gap-4">
          <span className="text-[#111111]">RSSI: -{Math.floor(Math.random() * 20 + 80)}dBm</span>
          <span className="text-[#111111]">SNR: {Math.floor(Math.random() * 5 + 5)}dB</span>
        </div>
      </div>
      <div className="flex gap-4">
        <div className="mt-1">
          {(pkt.priority || pkt.triage) === 'Red' ? (
            <ShieldAlert size={20} className="text-[#9F2F2D]" />
          ) : (
            <CheckCircle2 size={20} className="text-[#346538]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {!decompressed ? (
            <div className="text-[#787774] font-mono text-xs flex flex-col gap-3 py-2">
              <div className="flex items-center gap-2 text-[#956400] font-bold">
                <RefreshCw size={14} className="animate-spin" />
                <span>Decrypting & Decompressing LoRa payload...</span>
              </div>
              <div className="text-[10px] break-all opacity-40 bg-[#EAEAEA]/50 p-2 rounded">
                {btoa(encodeURIComponent(JSON.stringify(pkt))).substring(0, 120)}...
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-3">
                <span className="text-sm font-bold text-[#111111]">
                  {pkt.type === 'patient' ? `Patient: ${pkt.name}` : `Inventory: ${pkt.name}`}
                </span>
                <span className="text-[10px] text-[#346538] font-bold bg-[#EDF3EC] px-2 py-1 rounded-sm uppercase tracking-wider">
                  Decoded
                </span>
              </div>
              
              {pkt.type === 'patient' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="block text-[10px] text-[#787774] uppercase tracking-widest mb-1">Blood</span>
                    <span className="text-[#111111] font-medium">{pkt.blood}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#787774] uppercase tracking-widest mb-1">Allergy</span>
                    <span className="text-[#111111] font-medium">{pkt.allergy}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#787774] uppercase tracking-widest mb-1">Priority</span>
                    <span className={`font-bold ${pkt.triage === 'Red' ? 'text-[#9F2F2D]' : 'text-[#956400]'}`}>{pkt.triage}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#787774] uppercase tracking-widest mb-1">Contact</span>
                    <span className="text-[#111111] font-medium">{pkt.ePhone || 'N/A'}</span>
                  </div>
                  
                  <div className="col-span-2 md:col-span-4 bg-white p-3 rounded border border-[#EAEAEA]">
                    <span className="block text-[10px] text-[#787774] uppercase tracking-widest mb-1">Chief Complaint & Notes</span>
                    <span className="text-[#111111] font-medium block">{pkt.complaint}</span>
                    {pkt.notes && <span className="text-[#787774] mt-1 block">{pkt.notes}</span>}
                  </div>
                  
                  <div className="col-span-2 md:col-span-4 flex flex-wrap gap-x-6 gap-y-2 bg-white p-3 rounded border border-[#EAEAEA]">
                    <div><span className="text-[10px] text-[#787774] uppercase font-bold mr-1">BP:</span> <span className="font-medium text-[#111111]">{pkt.bp}</span></div>
                    <div><span className="text-[10px] text-[#787774] uppercase font-bold mr-1">SpO2:</span> <span className="font-medium text-[#111111]">{pkt.spo2}</span></div>
                    <div><span className="text-[10px] text-[#787774] uppercase font-bold mr-1">HR:</span> <span className="font-medium text-[#111111]">{pkt.hr}</span></div>
                    <div><span className="text-[10px] text-[#787774] uppercase font-bold mr-1">Temp:</span> <span className="font-medium text-[#111111]">{pkt.temp}</span></div>
                  </div>
                </div>
              )}
              
              {pkt.type === 'inventory' && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-[10px] text-[#787774] uppercase tracking-widest mb-1">Item ID</span>
                    <span className="text-[#111111] font-mono font-medium">{pkt.id}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#787774] uppercase tracking-widest mb-1">Tx Quantity</span>
                    <span className="text-[#111111] font-bold text-base">{pkt.qty}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default function LoRaReceiver() {
  const [packets, setPackets] = useState([]);
  const [isListening, setIsListening] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    let radioChannel;
    if (isListening) {
      radioChannel = new BroadcastChannel('lora_radio');
      radioChannel.onmessage = (event) => {
        if (event.data.type === 'AUTO_ADVANCE') return; // Filter out internal UI signals
        setPackets(prev => {
          const isDuplicate = prev.some(p => p.id === event.data.id && p.ts === event.data.ts);
          if (isDuplicate) return prev;
          return [...prev, { ...event.data, _receivedAt: new Date().toISOString() }];
        });
      };
    }
    return () => {
      if (radioChannel) radioChannel.close();
    };
  }, [isListening]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [packets]);

  return (
    <div className="flex flex-col h-[75vh] min-h-[600px] w-full">
      <div className="flex-1 bg-white border border-[#EAEAEA] rounded-xl overflow-hidden flex flex-col shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <div className="p-4 border-b border-[#EAEAEA] bg-[#FBFBFA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EAEAEA]"></div>
              <div className="w-3 h-3 rounded-full bg-[#EAEAEA]"></div>
              <div className="w-3 h-3 rounded-full bg-[#EAEAEA]"></div>
            </div>
            <span className="text-[#787774] font-mono text-xs ml-2">/dev/ttyUSB0</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsListening(!isListening)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest transition-colors ${
                isListening 
                  ? 'bg-[#EDF3EC] border-[#EDF3EC] text-[#346538] hover:bg-[#E3EFE2]' 
                  : 'bg-[#FDEBEC] border-[#FDEBEC] text-[#9F2F2D] hover:bg-[#FADBDC]'
              }`}
            >
              {isListening ? <Radio size={14} className="animate-pulse" /> : <Radio size={14} />}
              {isListening ? 'Listening' : 'Paused'}
            </button>
            <button 
              onClick={() => setPackets([])}
              className="btn-minimal-outline text-xs px-3 py-1.5 rounded-full bg-white"
            >
              <RotateCcw size={14} /> Clear
            </button>
          </div>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto font-mono text-sm bg-[#F7F6F3]">
            {packets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#787774]">
                <Radio size={48} className="opacity-20 mb-4" />
                <p>Waiting for transmissions...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <AnimatePresence initial={false}>
                  {packets.map((pkt, idx) => (
                    <PacketCard key={pkt.ts + idx} pkt={pkt} />
                  ))}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
