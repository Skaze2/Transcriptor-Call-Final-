import React, { useEffect, useState, useMemo } from 'react';
import { AgentConfig, ICONS } from '../types';
import { db, ref, set, get } from '../services/firebase';

interface Props {
    agentConfig: Record<string, AgentConfig>;
    onClose: () => void;
    onLogout: () => void;
}

const AdminPanel: React.FC<Props> = ({ agentConfig, onClose, onLogout }) => {
    // Local state for editing
    const [localConfig, setLocalConfig] = useState<Record<string, AgentConfig>>(agentConfig);
    const [dailyUsage, setDailyUsage] = useState<Record<string, number>>({});
    const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
    
    // Track edit mode per agent: 'list' (individual rows) or 'raw' (textarea)
    const [editModes, setEditModes] = useState<Record<string, 'list' | 'raw'>>({});

    // Track specific key being edited (revealed)
    const [editingKey, setEditingKey] = useState<{ agentId: string, index: number } | null>(null);

    // Track which agent is in "Bulk Add" mode
    const [bulkAddMode, setBulkAddMode] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let newConfig = { ...agentConfig };
        // Ensure ADMIN exists for UI even if not in DB yet
        if (!newConfig['ADMIN']) {
            newConfig['ADMIN'] = { id: 'ADMIN', name: 'ADMIN', pin: '9811', keys: '' };
        }
        setLocalConfig(newConfig);
        refreshUsage();
    }, [agentConfig]);

    // --- DUPLICATE DETECTION LOGIC ---
    // Calculates the frequency of every key across the entire system
    const duplicateMap = useMemo(() => {
        const freq: Record<string, number> = {};
        Object.values(localConfig).forEach(agent => {
            const keys = agent.keys ? agent.keys.split('\n') : [];
            keys.forEach(k => {
                const trimmed = k.trim();
                if (trimmed.length > 5) { // Only count "real" keys
                    freq[trimmed] = (freq[trimmed] || 0) + 1;
                }
            });
        });
        return freq;
    }, [localConfig]);

    const isKeyDuplicate = (key: string) => {
        const trimmed = key.trim();
        return trimmed.length > 5 && (duplicateMap[trimmed] || 0) > 1;
    };

    const agentHasDuplicates = (agent: AgentConfig) => {
        const keys = agent.keys ? agent.keys.split('\n') : [];
        return keys.some(k => isKeyDuplicate(k));
    };
    // ---------------------------------

    const refreshUsage = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        get(ref(db, `daily_stats/${todayStr}`)).then(snap => {
            setDailyUsage(snap.val() || {});
        });
    };

    const handleSave = () => {
        set(ref(db, 'agent_config'), localConfig)
            .then(() => {
                refreshUsage();
                setShowSaveConfirmation(true);
                setTimeout(() => setShowSaveConfirmation(false), 3000);
            })
            .catch(e => alert("Error: " + e.message));
    };

    const updateAgent = (id: string, field: keyof AgentConfig, value: string) => {
        setLocalConfig(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const toggleEditMode = (agentId: string) => {
        setEditModes(prev => ({
            ...prev,
            [agentId]: prev[agentId] === 'raw' ? 'list' : 'raw'
        }));
    };

    // --- Key List Logic ---
    const handleKeyChange = (agentId: string, index: number, value: string) => {
        const agent = localConfig[agentId];
        const keys = agent.keys.split('\n');
        keys[index] = value;
        updateAgent(agentId, 'keys', keys.join('\n'));
    };

    const handleDeleteKey = (agentId: string, index: number) => {
        const agent = localConfig[agentId];
        const keys = agent.keys.split('\n');
        keys.splice(index, 1);
        updateAgent(agentId, 'keys', keys.join('\n'));
    };

    const handleBulkAddSubmit = (agentId: string, text: string) => {
        if (!text.trim()) {
            setBulkAddMode(prev => ({ ...prev, [agentId]: false }));
            return;
        }

        const agent = localConfig[agentId];
        const currentKeys = agent.keys ? agent.keys.split('\n').filter(k => k.trim() !== '') : [];
        
        // Split pasted text by newlines, trim, and filter empty
        const newKeys = text.split(/\r?\n/).map(k => k.trim()).filter(k => k.length > 0);
        
        const combined = [...currentKeys, ...newKeys];
        
        updateAgent(agentId, 'keys', combined.join('\n'));
        setBulkAddMode(prev => ({ ...prev, [agentId]: false }));
    };

    const formatTime = (s: number) => {
        const h = Math.floor(s/3600);
        const m = Math.floor((s%3600)/60);
        const sec = Math.floor(s % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const renderKeyManager = (agent: AgentConfig) => {
        const mode = editModes[agent.id] || 'list'; 
        const isBulkAdd = bulkAddMode[agent.id];

        // Process keys for list view (filtering empties usually helps UI, but we keep sync with raw)
        const keyList = agent.keys.split('\n'); // .filter(k => k.trim() !== '') if we wanted to hide empties

        return (
            <div className="config-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label>Gestión de Llaves ({keyList.filter(k => k.length > 5).length}):</label>
                    <button 
                        onClick={() => toggleEditMode(agent.id)}
                        style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        {mode === 'raw' ? 'Ver Grid Inteligente' : 'Modo Texto (Raw)'}
                    </button>
                </div>

                {mode === 'raw' ? (
                    <textarea 
                        className="config-textarea" 
                        value={agent.keys}
                        onChange={(e) => updateAgent(agent.id, 'keys', e.target.value)}
                        placeholder="Pega tus API Keys aquí (una por línea)..."
                        style={{ minHeight: '150px', fontFamily: 'monospace', fontSize: '0.8rem' }}
                    />
                ) : (
                    <div className="bg-bg-body border border-border rounded-lg p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {/* 2-Column Grid */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            {keyList.map((k, idx) => {
                                // Skip empty lines in grid view to save space, unless being edited
                                if (k.trim() === '' && (!editingKey || editingKey.index !== idx)) return null;

                                const isEditing = editingKey?.agentId === agent.id && editingKey?.index === idx;
                                const maskedValue = k.length > 8 ? `•••• •••• ${k.slice(-4)}` : k;
                                
                                // CHECK DUPLICATE FOR THIS SPECIFIC KEY
                                const isDupe = isKeyDuplicate(k);

                                return (
                                    <div 
                                        key={idx} 
                                        className={`
                                            col-span-1 flex gap-1.5 items-center rounded p-1.5 group transition border
                                            ${isDupe ? 'bg-danger/10 border-danger' : 'bg-surface border-border hover:border-primary/50'}
                                        `}
                                    >
                                        {/* Visual Badge */}
                                        <div className={`shrink-0 px-1.5 py-0.5 rounded text-[0.65rem] font-bold font-mono border border-white/10 select-none min-w-[30px] text-center ${isDupe ? 'bg-danger text-white' : 'bg-[#422006] text-[#fde047]'}`}>
                                            #{idx + 1}
                                        </div>

                                        {/* Input / Masked View */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            {isEditing ? (
                                                <input 
                                                    autoFocus
                                                    type="text" 
                                                    className="w-full bg-input-bg text-text-main text-xs font-mono outline-none border-b border-primary p-0.5"
                                                    value={k}
                                                    placeholder="gsk_..."
                                                    onChange={(e) => handleKeyChange(agent.id, idx, e.target.value)}
                                                    onBlur={() => setEditingKey(null)}
                                                    onKeyDown={(e) => { if(e.key === 'Enter') setEditingKey(null); }}
                                                />
                                            ) : (
                                                <>
                                                    <div 
                                                        onClick={() => setEditingKey({ agentId: agent.id, index: idx })}
                                                        className={`text-xs font-mono cursor-pointer truncate select-none p-0.5 ${isDupe ? 'text-danger font-bold' : 'text-text-sec hover:text-text-main'}`}
                                                        title={isDupe ? "Esta llave está duplicada" : "Clic para editar"}
                                                    >
                                                        {maskedValue || <span className="text-danger italic">Vacío</span>}
                                                    </div>
                                                    {isDupe && <div className="text-[0.6rem] text-danger leading-none px-0.5">⚠ Duplicada</div>}
                                                </>
                                            )}
                                        </div>

                                        {/* Delete Action */}
                                        <button 
                                            onClick={() => handleDeleteKey(agent.id, idx)}
                                            className="shrink-0 text-text-sec hover:text-danger opacity-0 group-hover:opacity-100 transition px-1"
                                            title="Eliminar"
                                            dangerouslySetInnerHTML={{ __html: ICONS.trash }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        
                        {keyList.length === 0 && <div className="text-xs text-text-sec text-center py-2">Sin llaves configuradas.</div>}

                        {/* Bulk Add Action */}
                        {isBulkAdd ? (
                            <div className="animate-in fade-in zoom-in duration-200">
                                <textarea
                                    autoFocus
                                    className="w-full bg-surface-2 border border-primary rounded p-2 text-xs font-mono text-text-main outline-none placeholder:text-text-sec/50"
                                    placeholder="Pega aquí tus llaves (una por línea) y presiona fuera o Enter..."
                                    rows={3}
                                    onBlur={(e) => handleBulkAddSubmit(agent.id, e.target.value)}
                                    onKeyDown={(e) => { 
                                        if (e.key === 'Enter' && !e.shiftKey) { 
                                            e.preventDefault(); 
                                            e.currentTarget.blur(); 
                                        } 
                                        if (e.key === 'Escape') setBulkAddMode(prev => ({ ...prev, [agent.id]: false }));
                                    }}
                                />
                                <div className="text-[0.6rem] text-text-sec mt-1 text-right">Presiona Enter o clic fuera para guardar.</div>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setBulkAddMode(prev => ({ ...prev, [agent.id]: true }))}
                                className="w-full py-2 mt-1 border border-dashed border-border text-text-sec text-xs rounded hover:border-primary hover:text-primary hover:bg-surface-2 transition flex items-center justify-center gap-2"
                            >
                                <span className="text-lg leading-none">+</span> Agregar Multiples Llaves
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderCard = (agent: AgentConfig, isAdminCard: boolean = false) => {
        const keysCount = agent.keys.split('\n').filter(k => k.trim().length > 5).length;
        const capacity = keysCount * 28800; // 8 hours per key
        const used = dailyUsage[agent.name] || 0;
        const pct = capacity > 0 ? (used / capacity) * 100 : 0;
        const remaining = Math.max(0, capacity - used);
        
        // CHECK IF AGENT HAS DUPLICATES
        const hasError = agentHasDuplicates(agent);

        const cardStyle = {
            borderColor: hasError ? 'var(--danger)' : (isAdminCard ? '#f59e0b' : 'var(--border)'),
            boxShadow: hasError 
                ? '0 0 15px rgba(239, 68, 68, 0.2)' 
                : (isAdminCard ? '0 0 15px rgba(245, 158, 11, 0.15)' : '0 4px 6px rgba(0,0,0,0.1)'),
            marginBottom: isAdminCard ? '20px' : '0'
        };

        return (
            <div key={agent.id} className="agent-config-card" style={cardStyle}>
                <div className="agent-header" style={{ borderColor: hasError ? 'var(--danger)' : 'var(--border)' }}>
                    <h3 style={{ margin: 0, fontSize: isAdminCard ? '1.3rem' : '1.1rem', color: hasError ? 'var(--danger)' : (isAdminCard ? '#f59e0b' : 'var(--primary)'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isAdminCard ? '🔑 RECURSOS ADMIN' : agent.name}
                        {isAdminCard && <span style={{fontSize:'1rem'}}>👑</span>}
                        {hasError && <span style={{fontSize:'0.8rem', background: 'var(--danger)', color: 'white', padding: '1px 5px', borderRadius: '4px'}}>⚠ REVISAR</span>}
                    </h3>
                    <span className="agent-id" style={isAdminCard ? { borderColor: '#f59e0b', color: '#f59e0b' } : {}}>ID: {agent.id}</span>
                </div>

                <div className="admin-stats-row" style={isAdminCard ? {background: 'rgba(245, 158, 11, 0.1)'} : {}}>
                    <div className="stat-mini">
                        <span className="stat-mini-label">Llaves</span>
                        <span className="stat-mini-val" style={{ color: 'var(--text-main)' }}>{keysCount}</span>
                    </div>
                    <div className="stat-mini">
                        <span className="stat-mini-label">Capacidad Total</span>
                        <span className="stat-mini-val" style={{ color: 'var(--success)' }}>{formatTime(capacity)}</span>
                    </div>
                    <div className="stat-mini">
                        <span className="stat-mini-label">Consumido Hoy</span>
                        <span className="stat-mini-val" style={{ color: 'var(--warning)' }}>{formatTime(used)}</span>
                    </div>
                    <div className="stat-mini">
                        <span className="stat-mini-label">Restante Hoy</span>
                        <span className="stat-mini-val" style={{ color: 'var(--cyan)' }}>{formatTime(remaining)}</span>
                    </div>
                </div>

                <div style={{ marginTop: '-10px', marginBottom: '10px' }}>
                    <div className="capacity-bar-bg">
                        <div 
                            className="capacity-bar-fill" 
                            style={{ 
                                width: `${Math.min(pct, 100)}%`, 
                                background: pct > 90 ? 'var(--danger)' : 'var(--success)' 
                            }} 
                        />
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.65rem', color: 'var(--text-sec)', marginTop: '3px' }}>
                        {pct.toFixed(1)}% Usado
                    </div>
                </div>

                <div className="config-group">
                    <label>Nombre:</label>
                    <input 
                        type="text" 
                        className="config-input" 
                        value={agent.name}
                        onChange={(e) => updateAgent(agent.id, 'name', e.target.value)}
                        disabled={isAdminCard} // Admin name fixed
                    />
                </div>
                {!isAdminCard && (
                    <div className="config-group">
                        <label>PIN de Acceso:</label>
                        <input 
                            type="text" 
                            className="config-input" 
                            value={agent.pin}
                            onChange={(e) => updateAgent(agent.id, 'pin', e.target.value)}
                        />
                    </div>
                )}
                
                {/* Enhanced Key Manager */}
                {renderKeyManager(agent)}

            </div>
        );
    };

    const adminConfig = localConfig['ADMIN'];
    const otherAgents = Object.values(localConfig).filter((a: AgentConfig) => a.id !== 'ADMIN');

    return (
        <div className="admin-config-container animate-in slide-in-from-bottom duration-300">
            <header style={{ borderBottom: 'none', marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    🛡️ Gestión de Flota 
                    <span style={{ fontSize: '0.8rem', opacity: 0.7, border: '1px solid currentColor', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' }}>ADMIN MODE</span>
                </h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={onLogout} 
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        ⏻ CERRAR SESIÓN
                    </button>
                    <button 
                        onClick={onClose} 
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                        IR AL DASHBOARD ▶
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: 'var(--text-sec)', marginTop: '-10px', fontSize: '1rem' }}>Vista en tiempo real de recursos y asignaciones.</p>
                <button 
                    onClick={refreshUsage} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '1rem' }}
                >
                    🔄 Refrescar Consumos
                </button>
            </div>

            {/* Admin Card Full Width if possible or just first in flow */}
            <div style={{ marginTop: '30px' }}>
                {adminConfig && renderCard(adminConfig, true)}
            </div>

            <div className="agent-grid" style={{ marginTop: '20px' }}>
                {otherAgents.map((agent: AgentConfig) => renderCard(agent, false))}
            </div>

            <div className="admin-footer-bar">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-sec)' }}>Todos los cambios se sincronizan en tiempo real.</span>
                <button onClick={handleSave} className="btn-global-admin">
                    💾 GUARDAR CAMBIOS
                </button>
            </div>

            {/* POPUP CONFIRMATION */}
            {showSaveConfirmation && (
                <div style={{
                    position: 'fixed',
                    bottom: '100px', // Just above the footer bar
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'var(--success)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '50px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 10005,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    animation: 'slideUpFade 0.3s ease-out'
                }}>
                    <span style={{ fontSize: '1.2rem' }}>✅</span>
                    <span>Datos actualizados y guardados</span>
                </div>
            )}
            <style>{`
                @keyframes slideUpFade {
                    from { opacity: 0; transform: translate(-50%, 20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>
        </div>
    );
};

export default AdminPanel;