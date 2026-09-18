import React, { useState, useEffect, useRef } from 'react';
import { Radio, ShieldAlert, Cpu, CheckCircle2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LoRaReceiver() {
  const [packets, setPackets] = useState([]);
  const [isListening, setIsListening] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    let radioChannel;
    if (isListening) {
      radioChannel = new BroadcastChannel('lora_radio');
      radioChannel.onmessage = (event) => {
        if (event.data.type === 'inventory') return; // Filter out inventory from doctor's radio
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
    <div className="min-h-[100dvh] bg-[#F7F6F3] text-[#111111] font-sans selection:bg-[#EAEAEA] flex flex-col">
      <header className="w-full bg-white border-b border-[#EAEAEA] py-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] shrink-0">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-[#EAEAEA] rounded-md flex items-center justify-center bg-[#FBFBFA]">
              <Cpu size={20} className="text-[#111111]" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-medium tracking-tight m-0 leading-none">LoRa Gateway</h1>
              <p className="text-sm text-[#787774] mt-1 leading-none">868.0 MHz Receiver Terminal</p>
            </div>
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
              className="btn-minimal-outline text-xs px-3 py-1.5 rounded-full"
            >
              <RotateCcw size={14} /> Clear
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 flex flex-col">
        <div className="flex-1 bg-white border border-[#EAEAEA] rounded-xl overflow-hidden flex flex-col shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <div className="p-4 border-b border-[#EAEAEA] bg-[#FBFBFA] flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EAEAEA]"></div>
              <div className="w-3 h-3 rounded-full bg-[#EAEAEA]"></div>
              <div className="w-3 h-3 rounded-full bg-[#EAEAEA]"></div>
            </div>
            <span className="text-[#787774] font-mono text-xs ml-2">/dev/ttyUSB0</span>
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto font-mono text-sm bg-white">
            {packets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#787774]">
                <Radio size={48} className="opacity-20 mb-4" />
                <p>Waiting for transmissions...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <AnimatePresence initial={false}>
                  {packets.map((pkt, idx) => (
                    <motion.div 
                      key={idx}
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
                        <div className="flex-1">
                          <div className="text-[#111111] font-bold mb-2 break-all">
                            RAW: {JSON.stringify(pkt)}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#EAEAEA]">
                            <div>
                              <span className="block text-[10px] text-[#787774] uppercase tracking-widest">Type</span>
                              <span className="text-[#111111]">{pkt.type}</span>
                            </div>
                            {pkt.type === 'patient' && (
                              <>
                                <div>
                                  <span className="block text-[10px] text-[#787774] uppercase tracking-widest">Patient ID</span>
                                  <span className="text-[#111111]">{(pkt.patient_id || pkt.patientId || '').substring(0,8)}...</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] text-[#787774] uppercase tracking-widest">Priority</span>
                                  <span className={pkt.triage === 'Red' ? 'text-[#9F2F2D] font-bold' : 'text-[#346538] font-bold'}>
                                    {pkt.triage || pkt.priority || 'Standard'}
                                  </span>
                                </div>
                              </>
                            )}
                            {pkt.type === 'inventory' && (
                              <>
                                <div>
                                  <span className="block text-[10px] text-[#787774] uppercase tracking-widest">Item ID</span>
                                  <span className="text-[#111111]">{(pkt.id || '').substring(0,8)}...</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] text-[#787774] uppercase tracking-widest">Quantity</span>
                                  <span className="text-[#111111] font-bold">
                                    {pkt.qty}
                                  </span>
                                </div>
                              </>
                            )}
                            <div>
                              <span className="block text-[10px] text-[#787774] uppercase tracking-widest">ASHA ID</span>
                              <span className="text-[#111111]">{pkt.sender || 'Local'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
