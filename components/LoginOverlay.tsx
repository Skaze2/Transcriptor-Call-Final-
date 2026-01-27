import React, { useState } from 'react';
import { AgentConfig, UserRole } from '../types';

interface Props {
    agentConfig: Record<string, AgentConfig>;
    onLogin: (role: UserRole, username: string, userId?: string) => void;
}

const LoginOverlay: React.FC<Props> = ({ agentConfig, onLogin }) => {
    const [view, setView] = useState<'select' | 'admin' | 'agent'>('select');
    const [pin, setPin] = useState('');
    const [selectedAgentId, setSelectedAgentId] = useState('');

    const verifyAdmin = () => {
        if(pin === '9811') onLogin('admin', 'ADMIN');
        else alert('PIN Incorrecto');
    };

    const verifyAgent = () => {
        const agent = agentConfig[selectedAgentId];
        if(agent && agent.pin === pin) onLogin('agent', agent.name, agent.id);
        else alert('PIN Incorrecto');
    };

    return (
        <div className="fixed inset-0 bg-slate-900/98 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-surface p-10 rounded-2xl border border-border w-[400px] text-center shadow-2xl">
                <div className="text-2xl text-primary font-bold mb-5">🔒 Acceso Seguro</div>

                {view === 'select' && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                        <button onClick={() => setView('admin')} className="bg-surface-2 border-2 border-border hover:border-primary hover:bg-primary/10 transition rounded-xl p-5 flex flex-col items-center gap-2 text-text-main group">
                            <span className="text-3xl group-hover:scale-110 transition">🛡️</span>
                            <span className="font-semibold">Admin</span>
                        </button>
                        <button onClick={() => setView('agent')} className="bg-surface-2 border-2 border-border hover:border-primary hover:bg-primary/10 transition rounded-xl p-5 flex flex-col items-center gap-2 text-text-main group">
                            <span className="text-3xl group-hover:scale-110 transition">🎧</span>
                            <span className="font-semibold">Agente</span>
                        </button>
                    </div>
                )}

                {view === 'admin' && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <h4 className="text-text-main mb-4 font-medium">Acceso Administrativo</h4>
                        <input 
                            type="password" 
                            className="w-full p-3 bg-bg-body border border-border rounded-lg text-center text-xl tracking-[5px] mb-4 text-white focus:border-primary outline-none"
                            placeholder="PIN"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                        />
                        <button onClick={verifyAdmin} className="w-full bg-success text-white font-bold p-3 rounded-lg mb-3 hover:brightness-110 transition">VERIFICAR</button>
                        <button onClick={() => { setView('select'); setPin(''); }} className="text-text-sec text-sm hover:text-primary underline">← Volver</button>
                    </div>
                )}

                {view === 'agent' && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <h4 className="text-text-main mb-4 font-medium">Login Agente</h4>
                        <select 
                            className="w-full p-3 bg-bg-body border border-border rounded-lg mb-4 text-text-main outline-none focus:border-primary"
                            value={selectedAgentId}
                            onChange={(e) => setSelectedAgentId(e.target.value)}
                        >
                            <option value="" disabled>Selecciona tu Usuario</option>
                            {Object.values(agentConfig).map((a: AgentConfig) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                        <input 
                            type="password" 
                            className="w-full p-3 bg-bg-body border border-border rounded-lg text-center text-xl tracking-[5px] mb-4 text-white focus:border-primary outline-none"
                            placeholder="PIN"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                        />
                        <button onClick={verifyAgent} className="w-full bg-success text-white font-bold p-3 rounded-lg mb-3 hover:brightness-110 transition">INGRESAR</button>
                        <button onClick={() => { setView('select'); setPin(''); }} className="text-text-sec text-sm hover:text-primary underline">← Volver</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginOverlay;