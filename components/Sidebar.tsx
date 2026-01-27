import React, { useState, useMemo } from 'react';
import { ICONS } from '../types';

interface Props {
    keys: string[];
    keyUsage: Record<string, number>;
    keyLocks: Record<string, boolean>;
    keyOwners: Record<string, string>;
    onToggleLock: (key: string) => void;
    isAdmin: boolean;
    adminTestKeys?: Record<string, boolean>;
    onToggleTestKey?: (key: string) => void;
}

const SECONDS_PER_DAY = 28800; // 8 Hours

const Sidebar: React.FC<Props> = ({ keys, keyUsage, keyLocks, keyOwners, onToggleLock, isAdmin, adminTestKeys, onToggleTestKey }) => {
    
    // State to track which groups are expanded
    // Default: ADMIN expanded, others collapsed
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ 'ADMIN': true });

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // 1. Group Keys by Owner
    const groupedData = useMemo(() => {
        const groups: Record<string, string[]> = {};
        
        keys.forEach(key => {
            const owner = keyOwners[key] || 'Sin Asignar';
            if (!groups[owner]) groups[owner] = [];
            groups[owner].push(key);
        });

        // Calculate stats per group
        const groupStats = Object.keys(groups).map(owner => {
            const groupKeys = groups[owner];
            let totalCapacity = 0;
            let totalUsed = 0;

            groupKeys.forEach(k => {
                const safeKey = k.replace(/[.#$\[\]]/g, "_");
                totalCapacity += SECONDS_PER_DAY;
                totalUsed += (keyUsage[safeKey] || 0);
            });

            const remaining = Math.max(0, totalCapacity - totalUsed);
            const pct = totalCapacity > 0 ? (remaining / totalCapacity) * 100 : 0;

            return {
                owner,
                keys: groupKeys,
                totalCapacity,
                totalUsed,
                remaining,
                pct
            };
        });

        // Sort: ADMIN first, then others alphabetically
        return groupStats.sort((a, b) => {
            if (a.owner === 'ADMIN') return -1;
            if (b.owner === 'ADMIN') return 1;
            return a.owner.localeCompare(b.owner);
        });

    }, [keys, keyOwners, keyUsage]);

    // Global Stats for Top Header
    const globalRemaining = groupedData.reduce((acc, g) => acc + g.remaining, 0);

    return (
        <aside className="w-[300px] bg-[#050914] border-r border-border flex flex-col shrink-0 h-full">
            {/* Global Header */}
            <div className="p-5 border-b border-border text-center bg-surface/30">
                <div className="text-[0.7rem] uppercase tracking-widest text-text-sec font-semibold mb-2">Capacidad Flota Global</div>
                <div className="font-mono text-3xl font-bold text-text-main leading-none tracking-tight drop-shadow-lg text-primary">
                    {formatTime(globalRemaining)}
                </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
                {groupedData.length === 0 && <div className="text-center text-text-sec text-xs mt-10">Sin llaves asignadas</div>}

                {groupedData.map((group) => {
                    const isExpanded = expandedGroups[group.owner];
                    const isAdminGroup = group.owner === 'ADMIN';
                    
                    // Determine Group Color Status
                    let groupColorClass = "bg-success";
                    let groupTextClass = "text-success";
                    if (group.pct < 50) { groupColorClass = "bg-warning"; groupTextClass = "text-warning"; }
                    if (group.pct < 20) { groupColorClass = "bg-danger"; groupTextClass = "text-danger"; }

                    return (
                        <div key={group.owner} className={`rounded-xl border transition-all duration-200 overflow-hidden ${isAdminGroup ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface-2/20'}`}>
                            
                            {/* Group Header (Clickable) */}
                            <button 
                                onClick={() => toggleGroup(group.owner)}
                                className="w-full p-3 flex flex-col gap-2 hover:bg-white/5 transition text-left focus:outline-none"
                            >
                                <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[0.8rem] font-bold ${isAdminGroup ? 'text-primary' : 'text-text-main'}`}>
                                            {isAdminGroup ? '👑 ADMIN' : group.owner}
                                        </span>
                                        <span className="text-[0.65rem] px-1.5 py-0.5 bg-white/10 rounded text-text-sec">
                                            {group.keys.length} Llaves
                                        </span>
                                    </div>
                                    <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} opacity-50`}>
                                        ▼
                                    </span>
                                </div>

                                {/* Group Aggregate Bar */}
                                <div className="w-full">
                                    <div className="flex justify-between text-[0.65rem] font-mono mb-1 text-text-sec">
                                        <span>TOTAL</span>
                                        <span className={groupTextClass}>{formatTime(group.remaining)}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${groupColorClass}`} 
                                            style={{ width: `${group.pct}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </button>

                            {/* Expanded Individual Keys */}
                            {isExpanded && (
                                <div className="bg-[#020617] border-t border-border/50 p-2 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                                    {group.keys.map((key, idx) => {
                                        const safeKey = key.replace(/[.#$\[\]]/g, "_");
                                        const used = keyUsage[safeKey] || 0;
                                        const remaining = Math.max(0, SECONDS_PER_DAY - used);
                                        const pct = (remaining / SECONDS_PER_DAY) * 100;
                                        const isLocked = keyLocks[key];
                                        const isTestActive = adminTestKeys && adminTestKeys[key];

                                        let color = "text-success";
                                        let barColor = "bg-success";
                                        if(pct < 50) { color = "text-warning"; barColor = "bg-warning"; }
                                        if(pct < 20) { color = "text-danger"; barColor = "bg-danger"; }

                                        // Use index + 1 for intuitive labeling
                                        const keyLabel = `KEY #${idx + 1}`;

                                        return (
                                            <div key={key} className={`
                                                relative p-2 rounded border transition-all duration-200 flex flex-col gap-1.5
                                                ${isLocked ? 'opacity-50 grayscale border-dashed border-border' : 'bg-white/5 border-transparent hover:bg-surface-2'}
                                                ${pct <= 0 ? 'opacity-30 pointer-events-none border-danger' : ''}
                                                ${isTestActive ? 'border-cyan bg-cyan/10' : ''}
                                            `}>
                                                <div className="flex justify-between items-center mb-1">
                                                    {/* High contrast badge style matching QueueTable */}
                                                    <span className="px-2 py-0.5 rounded text-[0.7rem] font-bold font-mono bg-[#422006] text-[#fde047] border border-white/10 shadow-sm">
                                                        {keyLabel}
                                                    </span>
                                                    
                                                    <div className="flex gap-1">
                                                        {isAdmin && onToggleTestKey && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onToggleTestKey(key); }}
                                                                className={`p-1 rounded hover:bg-white/10 ${isTestActive ? 'text-cyan opacity-100' : 'text-text-sec opacity-30 hover:opacity-100'}`}
                                                                title="Usar llave para pruebas"
                                                                dangerouslySetInnerHTML={{ __html: ICONS.link }}
                                                            />
                                                        )}
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onToggleLock(key); }}
                                                            className={`p-1 rounded hover:bg-white/10 ${isLocked ? 'text-danger opacity-100' : 'text-text-sec opacity-50 hover:opacity-100'}`}
                                                            dangerouslySetInnerHTML={{ __html: isLocked ? ICONS.lockClosed : ICONS.lockOpen }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="h-[2px] w-full bg-white/10 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full shadow-[0_0_5px_currentColor] ${barColor}`} 
                                                        style={{ width: `${pct}%` }}
                                                    ></div>
                                                </div>
                                                <div className={`font-mono text-[0.6rem] text-right leading-none ${color}`}>
                                                    {formatTime(remaining)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};

export default Sidebar;