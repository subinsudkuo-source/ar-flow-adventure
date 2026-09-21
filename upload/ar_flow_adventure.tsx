import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Music, Star, Play, Hand, Wand2, ArrowDown, Loader2, CheckCircle2 } from 'lucide-react';

const GlobalStyles = () => (
    <style dangerouslySetInnerHTML={{__html: `
        :root {
            --mario-red: #E4000F;
            --mario-blue: #009BD9;
            --mario-yellow: #FCCF00;
            --mario-green: #44AF35;
            --sky-blue: #5c94fc;
        }
        body {
            font-family: 'Mali', 'Comic Sans MS', sans-serif;
            margin: 0; padding: 0; background-color: var(--sky-blue);
            touch-action: none; overflow: hidden; user-select: none; 
        }
        .camera-bg {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            object-fit: cover; z-index: -2; opacity: 0; transition: opacity 0.5s;
            transform: scaleX(-1);
        }
        .camera-active .camera-bg { opacity: 1; }
        .camera-active .scenery-bg { display: none; }

        .scenery-bg {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: var(--sky-blue); z-index: -2; opacity: 0.8;
            background-image: radial-gradient(circle at 50% 50%, #87CEEB 0%, #5c94fc 100%);
        }
        .btn-mario {
            background-color: var(--mario-red); color: white; border: 4px solid #fff;
            border-radius: 12px; box-shadow: 0 6px 0 #900, 0 8px 15px rgba(0,0,0,0.3);
            text-transform: uppercase; font-weight: bold; transition: all 0.1s;
        }
        .btn-mario:active { transform: translateY(6px); box-shadow: 0 0px 0 #900, 0 2px 5px rgba(0,0,0,0.3); }
        
        .bounce-anim { animation: bounce 0.5s infinite alternate; }
        @keyframes bounce { 0% { transform: translateY(0); } 100% { transform: translateY(-10px); } }

        .flow-line-down {
            width: 6px; height: 30px; background-color: #333; margin: 0 auto; position: relative; z-index: 0;
        }
        .flow-line-down::after {
            content: ''; position: absolute; bottom: -8px; left: -7px;
            border-width: 10px 10px 0; border-style: solid; border-color: #333 transparent transparent transparent;
        }
        
        .mario-glove {
            width: 48px; height: 48px; background-color: white; border: 4px solid black; 
            border-radius: 20px 20px 10px 10px; position: relative; box-shadow: 2px 4px 0 rgba(0,0,0,0.3);
            transition: transform 0.1s ease;
        }
        .mario-glove::after { 
            content: ''; position: absolute; top: 15px; left: 10px; width: 20px; height: 3px; background: black; box-shadow: 0 10px 0 black;
        }
        .glove-pinching { transform: scale(0.85) rotate(-15deg); background-color: #f0f0f0; border-width: 5px; }

        /* Keep the large, child-friendly UI inside shorter laptop/tablet screens. */
        @media (min-width: 768px) and (max-height: 1000px) {
            .viewport-fit-screen {
                transform: scale(0.78);
                transform-origin: center center;
            }
        }
        @media (min-width: 768px) and (max-height: 820px) {
            .viewport-fit-screen { transform: scale(0.66); }
        }
        @media (max-width: 767px) and (max-height: 740px) {
            .viewport-fit-screen {
                transform: scale(0.86);
                transform-origin: center center;
            }
        }
    `}} />
);

const CHAR_DATA = {
    mario: { id: 'mario', name: 'มาริโอ้', color: '#E4000F', pitch: 1.0, face: '#ffdcb1', hat: '#E4000F' },
    peach: { id: 'peach', name: 'เจ้าหญิงพีช', color: '#ffb3d9', pitch: 1.6, face: '#ffe6cc', hat: '#ffb3d9' },
    rosalina: { id: 'rosalina', name: 'โรซาลินา', color: '#4dd2ff', pitch: 1.4, face: '#ffe6cc', hat: '#4dd2ff' },
    luma: { id: 'luma', name: 'ลูม่า', color: '#FCCF00', pitch: 2.0, face: '#FCCF00', hat: '#FCCF00' }
};

const AudioSys = {
    ctx: null, bgmGain: null, bgmTimer: null, isBgmPlaying: false,
    init: function() { if (!this.ctx && window.AudioContext) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    playTone: function(f, type, dur, vol) {
        if (!this.ctx) return;
        try {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type; osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + dur);
        } catch(e) {}
    },
    coin: function() { this.playTone(1318.51, 'square', 0.1, 0.2); setTimeout(() => this.playTone(1975.53, 'square', 0.4, 0.2), 100); },
    jump: function() { this.playTone(400, 'square', 0.2, 0.2); },
    wrong: function() { this.playTone(150, 'sawtooth', 0.3, 0.2); },
    powerup: function() { [329.6, 392.0, 493.9, 523.3, 587.3, 659.3].forEach((f, i) => setTimeout(() => this.playTone(f, 'square', 0.1, 0.2), i*100)); },
    
    toggleBGM: function() { if(this.isBgmPlaying) this.stopBGM(); else this.startBGM(); },
    startBGM: function() {
        if (!this.ctx) this.init();
        if (this.bgmTimer) return;
        this.bgmGain = this.ctx.createGain(); this.bgmGain.gain.value = 0.015; this.bgmGain.connect(this.ctx.destination);
        const notes = [ 261, 330, 392, 523, 0, 392, 0, 330, 349, 440, 523, 698, 0, 523, 0, 440, 392, 494, 587, 784, 0, 587, 0, 494, 523, 392, 330, 261, 0, 0, 0, 0 ];
        let step = 0;
        const playStep = () => {
            const freq = notes[step];
            if (freq > 0) {
                const osc = this.ctx.createOscillator();
                osc.type = 'square'; osc.frequency.value = freq; osc.connect(this.bgmGain);
                osc.start(this.ctx.currentTime); osc.stop(this.ctx.currentTime + 0.1);
            }
            step = (step + 1) % notes.length;
            this.bgmTimer = setTimeout(playStep, 150);
        };
        this.isBgmPlaying = true; playStep();
    },
    stopBGM: function() { if (this.bgmTimer) { clearTimeout(this.bgmTimer); this.bgmTimer = null; this.isBgmPlaying = false; } },
    speak: function(text, pitch = 1.0) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text); 
            u.lang = 'th-TH'; u.rate = 0.8; u.pitch = pitch;
            window.speechSynthesis.speak(u);
        }
    }
};

const CharacterAvatar = ({ charId }) => {
    const char = CHAR_DATA[charId] || CHAR_DATA.mario;
    return (
        <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-white shadow-md relative overflow-hidden shrink-0" style={{ backgroundColor: char.color }}>
            <div className="absolute top-1 w-10 h-5 rounded-t-full" style={{ backgroundColor: char.hat }}></div> 
            <div className="absolute top-5 w-12 h-10 rounded-full" style={{ backgroundColor: char.face }}></div> 
            <div className="absolute top-7 left-3 w-2 h-2 bg-black rounded-full"></div> 
            <div className="absolute top-7 right-3 w-2 h-2 bg-black rounded-full"></div> 
        </div>
    );
};

const CharacterHelper = ({ text, charId = 'mario' }) => {
    const char = CHAR_DATA[charId] || CHAR_DATA.mario;
    return (
        <div className="flex items-end gap-2 md:gap-4 my-4 px-4 w-full max-w-7xl mx-auto z-10 pointer-events-auto">
            <div className="relative shrink-0 flex flex-col items-center">
                <div className="md:scale-125 transform origin-bottom"><CharacterAvatar charId={charId} /></div>
                <div className="text-white text-xs md:text-sm font-bold mt-2 bg-black/60 px-3 py-1 rounded-full">{char.name}</div>
            </div>
            <div className="bg-white border-4 p-4 md:p-6 rounded-2xl rounded-bl-none shadow-md flex-1 flex items-center justify-between gap-4" style={{ borderColor: char.color }}>
                <p className="text-[#333] font-bold text-lg md:text-3xl leading-relaxed">{text}</p>
                <button onClick={() => AudioSys.speak(text, char.pitch)} className="w-12 h-12 md:w-16 md:h-16 bg-yellow-400 rounded-full flex items-center justify-center text-orange-700 active:scale-90 shadow-sm shrink-0">
                    <Volume2 size={32} />
                </button>
            </div>
        </div>
    );
};

const useDragDropContext = () => {
    const [pointer, setPointer] = useState({ x: -1000, y: -1000, isDown: false, source: 'none' });
    const [draggedData, setDraggedData] = useState(null);
    const [dropAction, setDropAction] = useState(null);

    const updateHandPointer = useCallback((x, y, isPinching) => {
        setPointer(prev => {
            if (prev.source === 'hand') {
                const dist = Math.sqrt(Math.pow(prev.x - x, 2) + Math.pow(prev.y - y, 2));
                if (dist < 5 && prev.isDown === isPinching) return prev; 
            }
            return { x, y, isDown: isPinching, source: 'hand' };
        });
    }, []);

    const handlePointerMove = useCallback((e) => {
        if (pointer.source === 'hand') return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setPointer(prev => ({ ...prev, x: clientX, y: clientY, source: 'touch' }));
    }, [pointer.source]);

    const handlePointerDown = useCallback((e) => {
        if (pointer.source === 'hand') return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setPointer({ x: clientX, y: clientY, isDown: true, source: 'touch' });
    }, [pointer.source]);

    const handlePointerUp = useCallback(() => {
        if (pointer.source === 'hand') return;
        setPointer(prev => ({ ...prev, isDown: false }));
    }, [pointer.source]);

    useEffect(() => {
        if (pointer.isDown && !draggedData) {
            const elements = document.elementsFromPoint(pointer.x, pointer.y);
            const draggable = elements.find(el => el.getAttribute('data-draggable') === 'true');
            if (draggable) {
                AudioSys.jump();
                const id = draggable.getAttribute('data-id');
                const type = draggable.getAttribute('data-type');
                setDraggedData({ id, type, node: draggable });
            } else {
                const clickable = elements.find(el => el.getAttribute('data-clickable') === 'true');
                if (clickable) clickable.click();
            }
        } else if (!pointer.isDown && draggedData) {
            const elements = document.elementsFromPoint(pointer.x, pointer.y);
            const dropzone = elements.find(el => el.getAttribute('data-dropzone') === 'true');
            if (dropzone) {
                const zoneId = dropzone.getAttribute('data-id');
                setDropAction({ item: draggedData, zoneId: zoneId });
            }
            setDraggedData(null);
        }
    }, [pointer.isDown]); 

    const clearDropAction = useCallback(() => setDropAction(null), []);

    return { pointer, updateHandPointer, handlePointerMove, handlePointerDown, handlePointerUp, draggedData, dropAction, clearDropAction };
};

const Stage1 = ({ onComplete, charId, dropAction, clearDropAction }) => {
    const steps = [
        { id: 1, text: "พิจารณาปัญหา", color: "bg-red-500" },
        { id: 2, text: "วางแผนแก้ปัญหา", color: "bg-orange-500" },
        { id: 3, text: "ลงมือแก้ปัญหา", color: "bg-green-500" },
        { id: 4, text: "ตรวจสอบผล", color: "bg-blue-500" }
    ];
    const [placed, setPlaced] = useState([]);
    const [options, setOptions] = useState([...steps].sort(() => Math.random() - 0.5));
    const [msg, setMsg] = useState("ลากข้อความมาต่อเป็นบันได 1-4 จากล่างขึ้นบนเลย!");

    useEffect(() => { AudioSys.speak(msg, CHAR_DATA[charId]?.pitch); }, [msg, charId]);

    useEffect(() => {
        if (dropAction && dropAction.item.type === 's1-step') {
            const stepId = parseInt(dropAction.item.id);
            const targetZoneId = parseInt(dropAction.zoneId);
            const expectedId = placed.length + 1;

            if (targetZoneId === expectedId && stepId === expectedId) {
                AudioSys.coin();
                setPlaced(prev => [...prev, steps.find(s => s.id === stepId)]);
                setOptions(prev => prev.filter(o => o.id !== stepId));
                
                if (expectedId === 4) {
                    AudioSys.powerup();
                    setMsg("เย้! สร้างบันไดนักแก้ปัญหาสำเร็จแล้ว!");
                    setTimeout(() => onComplete(40, 3, ["นักคิดเป็นขั้นตอน"]), 5000); 
                } else {
                    setMsg("ถูกต้อง! ขั้นตอนที่ " + (expectedId+1) + " คืออะไรลากมาใส่เลย");
                }
            } else {
                AudioSys.wrong();
                setMsg("ยังไม่ใช่นะ ลำดับที่ " + expectedId + " ควรเป็นอะไร?");
            }
            clearDropAction();
        }
    }, [dropAction, placed.length, clearDropAction, onComplete, steps]);

    return (
        <div className="flex flex-col h-full z-10 w-full max-w-7xl mx-auto pointer-events-none">
            <div className="flex justify-between items-center bg-white/90 border-b-4 border-red-600 p-3 md:p-5 shadow-md w-full pointer-events-auto">
                <div className="font-black text-xl md:text-3xl text-red-600">ด่าน 1</div>
                <div className="flex items-center text-yellow-500 font-black text-xl md:text-2xl"><Star fill="currentColor" className="mr-2" /> {Math.floor(placed.length * 0.75)}</div>
            </div>
            
            <CharacterHelper text={msg} charId={charId} />
            
            <div className="flex-1 flex flex-col p-4 md:p-8 pointer-events-auto overflow-y-auto">
                <div className="flex-1 flex flex-col-reverse justify-start items-center gap-3 md:gap-5 mb-6">
                    {[1, 2, 3, 4].map(id => {
                        const isPlaced = placed.find(p => p.id === id);
                        const isNext = placed.length + 1 === id;
                        return (
                            <div key={id} data-dropzone="true" data-id={id}
                                className={`h-16 md:h-24 rounded-2xl flex items-center justify-center font-bold text-white text-xl md:text-4xl transition-all border-4 md:border-[6px]
                                ${isPlaced ? `${isPlaced.color} border-white shadow-lg` : 
                                  isNext ? 'bg-white/60 border-dashed border-yellow-400 animate-pulse text-gray-800' : 'bg-black/10 border-transparent text-transparent'}`}
                                style={{ width: `${100 - (4-id)*10}%` }}>
                                {isPlaced ? `${id}. ${isPlaced.text}` : (isNext ? `วางลำดับที่ ${id}` : '')}
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-6">
                    {options.map(s => (
                        <div key={s.id} data-draggable="true" data-type="s1-step" data-id={s.id}
                            className={`p-5 md:p-8 rounded-2xl border-4 md:border-[6px] border-white shadow-md text-center font-bold text-white text-2xl md:text-4xl cursor-grab active:scale-95 ${s.color}`}>
                            {s.text}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Stage2 = ({ onComplete, charId, dropAction, clearDropAction }) => {
    const sit = {
        title: "มดกินเศษอาหาร", 
        desc: "บอลกินขนมทิ้งไว้มดขึ้นโต๊ะ! ลากคำตอบไปเรียงลำดับให้ถูกนะ",
        correct: ["ปัญหา", "วางแผน", "ลงมือทำ", "ตรวจสอบ"],
        items: [
            { id: "ปัญหา", text: "มีเศษอาหาร มดขึ้นโต๊ะ" },
            { id: "วางแผน", text: "เก็บกวาด เช็ดโต๊ะ" },
            { id: "ลงมือทำ", text: "ทำความสะอาดจริง" },
            { id: "ตรวจสอบ", text: "โต๊ะสะอาด ไม่มีมด" }
        ]
    };

    const [slots, setSlots] = useState([null, null, null, null]);
    const [options, setOptions] = useState([...sit.items].sort(() => Math.random() - 0.5));
    const [msg, setMsg] = useState(sit.desc);

    useEffect(() => { AudioSys.speak(msg, CHAR_DATA[charId]?.pitch); }, [msg, charId]);

    useEffect(() => {
        if (dropAction && dropAction.item.type === 's2-item') {
            const itemObj = sit.items.find(i => i.id === dropAction.item.id);
            const zoneIndex = parseInt(dropAction.zoneId);

            AudioSys.jump();
            const newSlots = [...slots];
            const newOptions = [...options];

            if (zoneIndex >= 0 && zoneIndex < 4) {
                if (newSlots[zoneIndex]) newOptions.push(newSlots[zoneIndex]);
                newSlots[zoneIndex] = itemObj;
                setOptions(newOptions.filter(o => o.id !== itemObj.id));
                setSlots(newSlots);
            } else if (zoneIndex === -1) {
                if (!newOptions.find(o => o.id === itemObj.id)) {
                    newOptions.push(itemObj);
                    const slotIdx = newSlots.findIndex(s => s?.id === itemObj.id);
                    if(slotIdx > -1) newSlots[slotIdx] = null;
                    setOptions(newOptions);
                    setSlots(newSlots);
                }
            }
            clearDropAction();
        }
    }, [dropAction, slots, options, clearDropAction, sit.items]);

    useEffect(() => {
        if (slots.every(s => s !== null)) {
            const isWin = slots.every((s, i) => s.id === sit.correct[i]);
            if (isWin) {
                AudioSys.powerup();
                setMsg("สุดยอดไปเลย! แก้ปัญหาได้ถูกต้อง รับเหรียญไปเลยจ้า!");
                setTimeout(() => onComplete(40, 3, ["นักแก้ปัญหา"]), 5000); 
            } else {
                AudioSys.wrong();
                setMsg("ยังเรียงไม่ถูกนะจ๊ะ ลองคิดดูว่าอะไรเกิดก่อน-หลัง");
            }
        }
    }, [slots]); 

    return (
        <div className="flex flex-col h-full z-10 w-full max-w-7xl mx-auto pointer-events-none">
            <div className="flex justify-between items-center bg-white/90 border-b-4 border-red-600 p-3 md:p-5 shadow-md w-full pointer-events-auto">
                <div className="font-black text-xl md:text-3xl text-red-600">ด่าน 2</div>
                <div className="flex items-center text-yellow-500 font-black text-xl md:text-2xl"><Star fill="currentColor" className="mr-2" /> {slots.filter(s => s).length > 2 ? 1 : 0}</div>
            </div>
            
            <CharacterHelper text={msg} charId={charId} />

            <div className="flex-1 flex flex-col p-4 md:p-8 pointer-events-auto overflow-y-auto pb-20">
                <div className="bg-yellow-300 p-4 md:p-6 rounded-2xl border-4 border-yellow-500 mb-6 text-center shadow-md">
                    <h3 className="font-bold text-yellow-900 text-2xl md:text-4xl">{sit.title}</h3>
                </div>

                <div className="flex flex-col gap-3 md:gap-5 mb-6 bg-white/60 p-4 md:p-8 rounded-2xl border-4 border-white">
                    {sit.correct.map((stepName, i) => (
                        <div key={i} className="flex items-center gap-3 md:gap-6">
                            <div className="w-24 md:w-40 text-center bg-blue-500 text-white text-lg md:text-2xl font-bold py-4 md:py-6 rounded-xl shadow-sm">{stepName}</div>
                            <div data-dropzone="true" data-id={i} 
                                className={`flex-1 min-h-[4rem] md:min-h-[6rem] border-4 border-dashed rounded-2xl flex items-center justify-center p-2
                                ${slots[i] ? 'border-transparent bg-transparent' : 'border-gray-500 bg-white/70 animate-pulse'}`}>
                                
                                {slots[i] && (
                                    <div data-draggable="true" data-type="s2-item" data-id={slots[i].id}
                                        className="w-full h-full bg-white border-4 border-orange-400 p-3 md:p-6 rounded-xl shadow-md text-xl md:text-3xl font-bold text-center cursor-grab flex items-center justify-center">
                                        {slots[i].text}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div data-dropzone="true" data-id="-1" className="flex-1 min-h-[150px] md:min-h-[250px] bg-black/20 rounded-2xl p-4 md:p-8 flex flex-wrap gap-4 md:gap-8 content-start border-4 border-dashed border-white">
                    {options.map(opt => (
                        <div key={opt.id} data-draggable="true" data-type="s2-item" data-id={opt.id}
                            className="w-[47%] md:w-[48%] bg-white border-4 border-gray-300 p-4 md:p-6 rounded-2xl shadow-lg text-lg md:text-3xl font-bold text-center flex items-center justify-center min-h-[4rem] md:min-h-[6rem] cursor-grab">
                            {opt.text}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Stage3 = ({ onComplete, charId }) => {
    const symbols = [
        { id: 'start', name: 'วงรี', meaning: 'เริ่มต้น/สิ้นสุด', shape: 'rounded-[100%] bg-green-400' },
        { id: 'process', name: 'สี่เหลี่ยม', meaning: 'การทำงาน', shape: 'rounded-sm bg-blue-400' },
        { id: 'decision', name: 'ข้าวหลามตัด', meaning: 'การตัดสินใจ', shape: 'rotate-45 bg-yellow-400 scale-75 mt-2 mb-2' },
        { id: 'arrow', name: 'ลูกศร', meaning: 'ทิศทาง', shape: 'bg-transparent text-gray-800', icon: <ArrowDown size={64} /> },
    ];
    const questions = [
        { q: "ตรวจสอบว่า 'ไข่สุกหรือไม่' จิ้มรูปไหนดี?", a: 'decision' },
        { q: "'ตีไข่ให้เข้ากัน' จิ้มรูปไหน?", a: 'process' },
        { q: "คำว่า 'เริ่มต้น' ต้องใช้รูปอะไร?", a: 'start' }
    ];

    const [qIdx, setQIdx] = useState(0);
    const [msg, setMsg] = useState(questions[0].q);

    useEffect(() => { AudioSys.speak(questions[qIdx].q, CHAR_DATA[charId]?.pitch); }, [qIdx, charId]);

    const handleAnswer = (id) => {
        if (id === questions[qIdx].a) {
            AudioSys.coin();
            if (qIdx < questions.length - 1) {
                setQIdx(qIdx + 1);
                setMsg("ปิ๊งป่อง! ข้อต่อไป: " + questions[qIdx + 1].q);
            } else {
                AudioSys.powerup();
                setMsg("หนูเก่งมาก รู้จักสัญลักษณ์ผังงานครบแล้ว!");
                setTimeout(() => onComplete(30, 3, ["ผู้เชี่ยวชาญสัญลักษณ์"]), 5000); 
            }
        } else {
            AudioSys.wrong();
            setMsg("ผิดจ้า ลองดูความหมายใต้รูปดีๆ นะ");
        }
    };

    return (
        <div className="flex flex-col h-full z-10 w-full max-w-7xl mx-auto pointer-events-none">
            <div className="flex justify-between items-center bg-white/90 border-b-4 border-red-600 p-3 md:p-5 shadow-md w-full pointer-events-auto">
                <div className="font-black text-xl md:text-3xl text-red-600">ด่าน 3</div>
                <div className="flex items-center text-yellow-500 font-black text-xl md:text-2xl"><Star fill="currentColor" className="mr-2" /> {qIdx}</div>
            </div>
            
            <CharacterHelper text={msg} charId={charId} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 p-4 md:p-8 content-start pointer-events-auto overflow-y-auto pb-20">
                {symbols.map(sym => (
                    <button key={sym.id} data-clickable="true" onClick={() => handleAnswer(sym.id)}
                        className="bg-white border-4 md:border-8 border-b-8 md:border-b-[12px] border-gray-300 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center gap-4 active:translate-y-2 active:border-b-4 transition-all shadow-lg hover:bg-blue-50">
                        <div className={`w-24 h-24 md:w-32 md:h-32 flex items-center justify-center border-4 border-black shadow-inner ${sym.shape}`}>
                            <div className="text-white">
                                {sym.icon}
                            </div>
                        </div>
                        <div className="text-center w-full leading-tight mt-4">
                            <div className="font-bold text-xl md:text-3xl">{sym.name}</div>
                            <div className="text-sm md:text-xl text-gray-600 mt-2">{sym.meaning}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

const Stage4 = ({ onComplete, charId, dropAction, clearDropAction }) => {
    const flow = [
        { id: 'start', type: 'start', text: 'เริ่มต้น' },
        { id: 'prep', type: 'process', text: 'ตอกไข่ ใส่ซอส' },
        { id: 'cook', type: 'process', text: 'อุ่น 3 นาที' },
        { id: 'check', type: 'decision', text: 'สุกไหม?' },
        { id: 'end', type: 'start', text: 'สิ้นสุด' }
    ];
    
    const [currentIdx, setCurrentIdx] = useState(1); 
    const [msg, setMsg] = useState("มาสร้างผังงานทำไข่ตุ๋นกัน! ลากกล่องข้อความมาต่อด้านล่างเลย");
    
    useEffect(() => { AudioSys.speak(msg, CHAR_DATA[charId]?.pitch); }, [msg, charId]);

    useEffect(() => {
        if (dropAction && dropAction.item.type === 's4-item') {
            const stepId = dropAction.item.id;
            const expectedId = flow[currentIdx].id;

            if (dropAction.zoneId === 'next-slot' && stepId === expectedId) {
                AudioSys.coin();
                if (currentIdx === flow.length - 1) {
                    AudioSys.powerup();
                    setMsg("ยอดเยี่ยมมาก! การที่ไข่ไม่สุกแล้ววนกลับไปทำใหม่ เรียกว่า 'การวนซ้ำ' นะจ๊ะ!");
                    setTimeout(() => onComplete(50, 3, ["นักอ่านผังงาน"]), 8000); 
                } else {
                    setCurrentIdx(prev => prev + 1);
                    setMsg("เยี่ยม! ขั้นตอนต่อไปคืออะไร?");
                }
            } else {
                AudioSys.wrong();
                setMsg("ยังไม่ใช่นะ ลองเรียงลำดับใหม่ดูดีๆ");
            }
            clearDropAction();
        }
    }, [dropAction, currentIdx, clearDropAction, flow]);

    const getStyle = (type) => {
        const base = "font-bold text-xl md:text-3xl text-center flex items-center justify-center border-4 md:border-8 z-10 px-4 py-4 md:px-8 md:py-6 w-48 md:w-80 shadow-md";
        if (type === 'start') return `${base} rounded-full bg-green-300 border-green-600`;
        if (type === 'process') return `${base} rounded-xl bg-blue-200 border-blue-600`;
        if (type === 'decision') return `${base} bg-yellow-300 border-yellow-600 py-10 md:py-16 scale-110 md:scale-125 my-6 md:my-10`;
        return base;
    };

    const options = flow.filter((_, i) => i >= currentIdx).sort(() => Math.random() - 0.5);

    return (
        <div className="flex flex-col h-full z-10 w-full max-w-7xl mx-auto pointer-events-none">
            <div className="flex justify-between items-center bg-white/90 border-b-4 border-red-600 p-3 md:p-5 shadow-md w-full pointer-events-auto">
                <div className="font-black text-xl md:text-3xl text-red-600">ด่าน 4</div>
                <div className="flex items-center text-yellow-500 font-black text-xl md:text-2xl"><Star fill="currentColor" className="mr-2" /> {Math.floor(currentIdx/1.5)}</div>
            </div>

            <CharacterHelper text={msg} charId={charId} />

            <div className="flex-1 overflow-y-auto bg-white/60 m-4 rounded-3xl border-4 md:border-8 border-white relative p-6 pb-40 pointer-events-auto shadow-inner">
                <div className="flex flex-col items-center mt-6">
                    {flow.slice(0, currentIdx).map((step, i) => (
                        <div key={i} className="flex flex-col items-center relative w-full">
                            <div className={getStyle(step.type)}
                                 style={step.type === 'decision' ? { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' } : {}}>
                                {step.text}
                            </div>

                            {step.type === 'decision' && (
                                <>
                                    <div className="absolute right-[5%] md:right-[20%] top-1/2 w-[25%] md:w-[20%] h-[6px] md:h-[8px] bg-black"></div>
                                    <div className="absolute right-[2%] md:right-[15%] top-[35%] md:top-[40%] text-sm md:text-xl font-bold text-white bg-red-500 px-3 py-1 rounded">ไม่สุก</div>
                                    <div className="absolute right-[5%] md:right-[20%] top-[-100px] md:top-[-160px] w-[6px] md:w-[8px] h-[100px] md:h-[160px] bg-black"></div>
                                    <div className="absolute right-[5%] md:right-[20%] top-[-100px] md:top-[-160px] w-[20%] md:w-[15%] h-[6px] md:h-[8px] bg-black"></div>
                                    <div className="absolute right-[25%] md:right-[35%] top-[-115px] md:top-[-175px] text-black rotate-90 scale-150"><ArrowDown size={24} strokeWidth={4} /></div>
                                </>
                            )}
                            
                            {i < currentIdx - 1 && <div className="flow-line-down md:h-12"></div>}
                            {step.type === 'decision' && i === currentIdx - 1 && (
                                <><div className="flow-line-down md:h-12"></div><div className="text-sm md:text-xl text-white bg-green-500 font-bold px-3 py-1 absolute -bottom-5 z-20 rounded shadow-md">สุก</div></>
                            )}
                        </div>
                    ))}

                    {currentIdx < flow.length && (
                        <div className="w-full flex flex-col items-center">
                            {currentIdx > 0 && flow[currentIdx-1].type !== 'decision' && <div className="flow-line-down md:h-12"></div>}
                            <div data-dropzone="true" data-id="next-slot" 
                                className="w-48 md:w-80 h-16 md:h-24 border-4 md:border-8 border-dashed border-gray-600 rounded-xl flex items-center justify-center text-gray-700 bg-white/70 mt-2 font-bold animate-pulse text-xl md:text-3xl shadow-inner">
                                ลากวางที่นี่
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {currentIdx < flow.length && (
                <div className="absolute bottom-0 left-0 w-full bg-[#ffcc99] border-t-4 md:border-t-8 border-[#cc6600] p-4 md:p-8 flex justify-center gap-4 z-20 pointer-events-auto shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">
                    {options.map(opt => (
                        <div key={opt.id} data-draggable="true" data-type="s4-item" data-id={opt.id}
                            className="bg-white border-4 md:border-[6px] border-black p-4 md:p-6 rounded-2xl text-xl md:text-3xl font-bold shadow-lg cursor-grab active:scale-95 active:bg-gray-100 flex items-center justify-center min-w-[120px] md:min-w-[200px]">
                            {opt.text}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function App() {
    const [screen, setScreen] = useState('home'); 
    const [char, setChar] = useState('mario');
    const [score, setScore] = useState(0);
    const [stars, setStars] = useState(0);
    const [badges, setBadges] = useState([]);
    const [arMode, setArMode] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const handsRef = useRef(null);
    const cameraRef = useRef(null);
    
    const { pointer, updateHandPointer, handlePointerMove, handlePointerDown, handlePointerUp, draggedData, dropAction, clearDropAction } = useDragDropContext();

    const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src; script.crossOrigin = "anonymous";
        script.onload = resolve; script.onerror = reject;
        document.body.appendChild(script);
    });

    const initHandTracking = async () => {
        try {
            setIsAiLoading(true);
            await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
            await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
            await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");

            const hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
            hands.setOptions({
                maxNumHands: 1, modelComplexity: 0, 
                minDetectionConfidence: 0.6, minTrackingConfidence: 0.6
            });

            hands.onResults((results) => {
                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    const landmarks = results.multiHandLandmarks[0];
                    const indexTip = landmarks[8];
                    const thumbTip = landmarks[4];
                    const dist = Math.sqrt(Math.pow(indexTip.x - thumbTip.x, 2) + Math.pow(indexTip.y - thumbTip.y, 2));
                    const isPinching = dist < 0.07; 
                    const x = (1 - indexTip.x) * window.innerWidth;
                    const y = indexTip.y * window.innerHeight;
                    updateHandPointer(x, y, isPinching);
                } else {
                    updateHandPointer(-1000, -1000, false);
                }
            });

            handsRef.current = hands;
            const camera = new window.Camera(videoRef.current, {
                onFrame: async () => { await hands.send({image: videoRef.current}); },
                width: 640, height: 480
            });
            cameraRef.current = camera;
            camera.start();
            setIsAiLoading(false);
            setScreen('char');
        } catch (err) {
            console.error("Failed to init Hand Tracking", err);
            alert('ไม่สามารถโหลด AI สแกนมือได้ จะเข้าสู่โหมด 2D แทนนะจ๊ะ (อาจเกิดจากเน็ตเวิร์ก)');
            start2D();
        }
    };

    const startAR = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
            streamRef.current = stream;
            setArMode(true);
            AudioSys.init(); AudioSys.startBGM(); setIsMusicPlaying(true);
            initHandTracking(); 
        } catch (err) {
            alert('ไม่สามารถเปิดกล้องได้ จะเล่นในโหมด 2D แทนนะจ๊ะ (อาจเป็นเพราะ Browser Block)');
            start2D();
        }
    };

    const start2D = () => { 
        setArMode(false); AudioSys.init(); AudioSys.startBGM(); setIsMusicPlaying(true);
        setIsAiLoading(false); setScreen('char'); 
    };

    const stopCamera = () => {
        if (cameraRef.current) cameraRef.current.stop();
        if (handsRef.current) handsRef.current.close();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleComplete = (s, st, b) => {
        setScore(prev => prev + s); setStars(prev => prev + st); setBadges(prev => [...prev, ...b]);
        const next = { 'stage1': 'stage2', 'stage2': 'stage3', 'stage3': 'stage4', 'stage4': 'summary' }[screen];
        setScreen(next);
        if (next === 'summary') stopCamera();
    };

    return (
        <div className={`w-full min-h-[100svh] h-[100dvh] relative flex flex-col ${arMode ? 'camera-active' : ''}`}
            onPointerMove={handlePointerMove} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onMouseLeave={handlePointerUp}>
            <GlobalStyles />
            <video ref={videoRef} autoPlay playsInline muted className="camera-bg"></video>
            <div className="scenery-bg"></div>

            {screen !== 'home' && (
                <button onClick={() => { AudioSys.toggleBGM(); setIsMusicPlaying(AudioSys.isBgmPlaying); }}
                    className="fixed top-4 right-4 z-[99999] bg-white border-4 border-yellow-400 p-3 rounded-full shadow-lg active:scale-95 text-yellow-600 pointer-events-auto">
                    <Music size={32} className={isMusicPlaying ? 'animate-bounce' : 'opacity-40'} />
                </button>
            )}

            {isAiLoading && (
                <div className="absolute inset-0 bg-black/80 z-[10000] flex flex-col items-center justify-center text-white p-4 text-center">
                    <Loader2 size={80} className="animate-spin text-yellow-400 mb-6" />
                    <h2 className="text-3xl md:text-5xl font-bold mb-4">กำลังเรียกเวทมนตร์...</h2>
                    <p className="text-lg md:text-2xl">ดาวน์โหลด AI จับการเคลื่อนไหวมือ (รอสักครู่นะ)</p>
                </div>
            )}
            
            <div className="fixed inset-0 z-[9999] pointer-events-none">
                {draggedData && pointer.isDown && (
                    <div className="absolute transform -translate-x-1/2 -translate-y-1/2 scale-110 opacity-90 drop-shadow-xl"
                         style={{ left: pointer.x, top: pointer.y }}
                         dangerouslySetInnerHTML={{__html: draggedData.node.outerHTML}} />
                )}
                
                {pointer.source === 'hand' && !draggedData && (
                     <div className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                          style={{ left: pointer.x, top: pointer.y }}>
                         <div className={`mario-glove ${pointer.isDown ? 'glove-pinching' : ''}`}></div>
                     </div>
                )}

                {pointer.source === 'touch' && pointer.isDown && !draggedData && (
                     <div className="absolute transform -translate-x-1/2 -translate-y-1/2 opacity-50 text-yellow-400"
                          style={{ left: pointer.x, top: pointer.y }}>
                        <Hand size={48} fill="currentColor" />
                     </div>
                )}
            </div>

            <div className="flex-1 w-full h-full flex flex-col relative overflow-hidden z-10 pointer-events-none">
                
                {screen === 'home' && (
                    <div className="viewport-fit-screen flex-1 flex flex-col items-center justify-center p-5 md:p-8 text-center w-full max-w-7xl mx-auto pointer-events-auto">
                        <div className="bg-yellow-400 border-4 md:border-8 border-white w-32 h-32 md:w-48 md:h-48 flex items-center justify-center mb-8 bounce-anim text-6xl md:text-9xl font-black rounded-2xl shadow-xl text-orange-600">?</div>
                        <h1 className="text-5xl md:text-8xl font-black text-red-600 mb-4 uppercase drop-shadow-[4px_4px_0_#fff]">AR Flow<br/>Adventure</h1>
                        <h2 className="text-2xl md:text-5xl font-bold text-blue-800 mb-12 bg-white/90 px-8 py-4 rounded-full border-4 border-blue-200 shadow-md">ภารกิจนักแก้ปัญหาตัวน้อย</h2>
                        
                        <button onClick={startAR} className="btn-mario w-full max-w-2xl text-2xl md:text-4xl py-6 md:py-8 mb-6 flex justify-center gap-3 items-center flex-col h-auto">
                            <div className="flex items-center gap-4"><Wand2 size={48} /> เล่นโหมดลากด้วยมือ (AR AI)</div>
                            <span className="text-sm md:text-xl text-yellow-200 mt-2">(เปิดกล้อง จับมือผ่าน AI)</span>
                        </button>
                        <button onClick={start2D} className="bg-white border-4 md:border-8 border-gray-400 text-gray-700 w-full max-w-2xl font-bold py-5 md:py-6 rounded-2xl flex justify-center gap-3 shadow-lg active:scale-95 transition-transform flex-col items-center text-xl md:text-3xl">
                            <div className="flex items-center gap-4"><Hand size={40} /> เล่นโหมดปกติ (2D)</div>
                            <span className="text-sm md:text-xl text-gray-500 mt-2">(ใช้นิ้วจิ้มหน้าจอ)</span>
                        </button>
                    </div>
                )}

                {screen === 'char' && (
                    <div className="viewport-fit-screen flex-1 flex flex-col justify-center p-5 md:p-6 w-full max-w-7xl mx-auto pointer-events-auto">
                        <h2 className="text-4xl md:text-6xl font-black text-center text-white bg-blue-600 border-8 border-white p-6 rounded-3xl mb-10 shadow-xl">เลือกตัวละคร</h2>
                        {arMode && <p className="text-center text-yellow-300 bg-black/70 font-bold mb-10 rounded-2xl p-4 text-xl md:text-3xl shadow-lg">💡 ทดลองจีบนิ้วเพื่อทำท่า "หยิบ" ได้เลย!</p>}
                        <div className="grid grid-cols-2 gap-6 md:gap-10">
                            {Object.values(CHAR_DATA).map(c => (
                                <button key={c.id} data-clickable="true" onClick={() => { AudioSys.jump(); setChar(c.id); setScreen('stage1'); }}
                                    className="bg-white border-8 p-8 md:p-12 rounded-3xl flex flex-col items-center gap-6 active:scale-95 shadow-xl transition-transform hover:bg-gray-50" style={{borderColor: c.color}}>
                                    <div className="scale-150 md:scale-[2.5] mb-6 md:mb-10"><CharacterAvatar charId={c.id} /></div>
                                    <span className="font-bold text-gray-800 text-2xl md:text-5xl mt-4">{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {screen === 'stage1' && <Stage1 onComplete={handleComplete} charId={char} dropAction={dropAction} clearDropAction={clearDropAction} />}
                {screen === 'stage2' && <Stage2 onComplete={handleComplete} charId={char} dropAction={dropAction} clearDropAction={clearDropAction} />}
                {screen === 'stage3' && <Stage3 onComplete={handleComplete} charId={char} />}
                {screen === 'stage4' && <Stage4 onComplete={handleComplete} charId={char} dropAction={dropAction} clearDropAction={clearDropAction} />}

                {screen === 'summary' && (
                    <div className="flex-1 flex flex-col items-center p-8 md:p-16 text-center w-full max-w-7xl mx-auto pointer-events-auto bg-white/95 overflow-y-auto">
                        <Star size={120} fill="#FCCF00" color="#e6a800" className="bounce-anim drop-shadow-xl mb-6 mt-8" />
                        <h1 className="text-5xl md:text-8xl font-black text-red-600 mb-6 uppercase">ภารกิจสำเร็จ!</h1>
                        <p className="font-bold text-blue-600 mb-10 text-2xl md:text-5xl">หนูเป็นนักแก้ปัญหาตัวน้อยแล้ว!</p>
                        
                        <div className="bg-blue-50 p-8 md:p-12 rounded-3xl border-8 border-blue-400 w-full mb-10 text-left shadow-inner">
                            <div className="flex justify-between items-center mb-6 md:mb-8 border-b-4 border-blue-200 pb-6">
                                <span className="font-bold text-gray-700 text-2xl md:text-4xl">คะแนนรวม</span>
                                <span className="font-black text-4xl md:text-6xl text-blue-600">{score}</span>
                            </div>
                            <div className="flex justify-between items-center mb-8 md:mb-10 border-b-4 border-blue-200 pb-6">
                                <span className="font-bold text-gray-700 text-2xl md:text-4xl">ดาวสะสม</span>
                                <span className="font-black text-4xl md:text-6xl text-yellow-500 flex items-center"><Star fill="currentColor" size={48} className="mr-3" /> {stars}/12</span>
                            </div>
                            <h3 className="font-bold text-gray-800 mb-6 text-2xl md:text-4xl">เหรียญความสำเร็จ:</h3>
                            <div className="flex flex-wrap gap-4 md:gap-6">
                                {badges.map((b,i) => <span key={i} className="bg-yellow-400 text-orange-900 text-lg md:text-3xl font-bold px-5 py-3 rounded-full border-4 border-white shadow-md flex items-center"><CheckCircle2 className="mr-2" /> {b}</span>)}
                            </div>
                        </div>

                        <button onClick={() => window.location.reload()} className="btn-mario w-full max-w-2xl py-6 md:py-8 text-2xl md:text-4xl flex justify-center items-center gap-4">
                            <Play size={40} fill="currentColor" /> เล่นอีกครั้ง
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
