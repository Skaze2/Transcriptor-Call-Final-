
import React, { useState } from 'react';
import { Job, UserRole, ICONS } from '../types';
import QueueTable from './QueueTable';
import HistoryArchive from './HistoryArchive';
import TeamStats from './TeamStats';

interface Props {
    userRole: UserRole;
    currentUser: string;
    theme: 'dark'|'light';
    toggleTheme: () => void;
    jobs: Job[];
    keys: string[];
    isProcessing: boolean;
    globalPaused: boolean;
    maxConcurrency: number;
    setMaxConcurrency: (n: number) => void;
    selectedModel: string;
    setSelectedModel: (s: string) => void;
    onFilesAdded: (files: FileList) => void;
    onStart: () => void;
    onPauseAll: () => void;
    onCancelJob: (id: string) => void;
    onRetryJob: (id: string) => void;
    onOpenAdmin: () => void;
    updateJob: (id: string, updates: Partial<Job>) => void;
    onLogout: () => void;
}

const Dashboard: React.FC<Props> = ({ 
    userRole, currentUser, theme, toggleTheme, jobs, keys, 
    isProcessing, globalPaused, maxConcurrency, setMaxConcurrency,
    selectedModel, setSelectedModel, onFilesAdded, onStart, onPauseAll,
    onCancelJob, onRetryJob, onOpenAdmin, updateJob, onLogout
}) => {
    const [tab, setTab] = useState<'active' | 'archive' | 'team'>('active');

    // Stats
    const stats = {
        process: jobs.filter(j => j.status === 'active' && !j.paused).length,
        done: jobs.filter(j => j.status === 'done').length,
        pending: jobs.filter(j => j.status === 'pending').length,
        error: jobs.filter(j => j.status === 'error').length,
        paused: jobs.filter(j => j.status === 'active' && j.paused).length,
        dl: jobs.filter(j => j.status === 'done' && !j.downloaded).length
    };

    // RAM Estimation
    const estRam = (0.15 + (maxConcurrency * 0.3)).toFixed(1);
    let ramClass = "text-success bg-success/10 border-success";
    if(Number(estRam) >= 4) ramClass = "text-warning bg-warning/10 border-warning";
    if(Number(estRam) >= 10) ramClass = "text-danger bg-danger/10 border-danger";

    const handleDownloadAll = async () => {
        // Filter: Done AND has blob AND NOT downloaded yet
        const finishedJobs = jobs.filter(j => j.status === 'done' && j.docBlob && !j.downloaded);
        if (finishedJobs.length === 0) return;

        // Iterate and download with delay to prevent browser blocking
        for (const job of finishedJobs) {
            if (job.docBlob) {
                const url = URL.createObjectURL(job.docBlob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${job.fileName.split('.')[0]}_Stereo.doc`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                updateJob(job.id, { downloaded: true });

                // 500ms delay to help browser queue downloads
                await new Promise(r => setTimeout(r, 500));
            }
        }
    };

    // Count pending downloads for the button label
    const pendingDownloadsCount = jobs.filter(j => j.status === 'done' && !j.downloaded).length;

    return (
        <div className="w-full max-w-[1100px] mx-auto bg-surface rounded-2xl shadow-2xl border border-border p-10 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex justify-between items-center mb-8 pb-6 border-b border-border">
                <div>
                    <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
                        🎧 Transcriptor Pro 
                        <span className="text-xs opacity-70 border border-current px-1.5 rounded align-middle">TEAM</span>
                        <span className="text-sm bg-primary text-white px-2 py-0.5 rounded ml-2">{currentUser.toUpperCase()}</span>
                    </h1>
                    <p className="mt-2 text-text-sec text-sm">Suite de Transcripción Estéreo (Conectado a Firebase)</p>
                </div>
                <div className="flex items-center gap-4">
                    {userRole === 'admin' && (
                        <button onClick={onOpenAdmin} className="text-sm font-bold text-primary border border-primary px-3 py-1.5 rounded hover:bg-primary/10 transition">
                            ADMIN CONFIG
                        </button>
                    )}
                    <button onClick={toggleTheme} className="text-2xl hover:scale-110 transition">
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button onClick={onLogout} className="text-sm font-bold text-text-sec hover:text-danger border border-transparent hover:border-danger px-3 py-1.5 rounded transition flex items-center gap-2" title="Cerrar sesión">
                        <span>⏻</span> SALIR
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-surface-2 p-1.5 rounded-xl w-fit border border-border">
                {[
                    { id: 'active', label: '📅 Cola de Trabajo (Hoy)' },
                    { id: 'archive', label: '🗄️ Mi Histórico' },
                    { id: 'team', label: '🌍 Equipo (Global)' }
                ].map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setTab(t.id as any)}
                        className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${tab === t.id ? 'bg-surface text-primary shadow-sm' : 'text-text-sec hover:bg-white/5 hover:text-text-main'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ACTIVE TAB CONTENT */}
            {tab === 'active' && (
                <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                        {[
                            { label: 'En Proceso', val: stats.process, color: 'text-purple', border: 'border-l-purple' },
                            { label: 'Finalizadas', val: stats.done, color: 'text-success', border: 'border-l-success' },
                            { label: 'Pendientes', val: stats.pending, color: 'text-text-sec', border: 'border-l-text-sec' },
                            { label: 'Error', val: stats.error, color: 'text-danger', border: 'border-l-danger' },
                            { label: 'Pausadas', val: stats.paused, color: 'text-warning', border: 'border-l-warning' },
                            { label: 'Falta DL', val: stats.dl, color: 'text-cyan', border: 'border-l-cyan' },
                        ].map((s, i) => (
                            <div key={i} className={`bg-bg-body border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary hover:-translate-y-0.5 transition border-l-4 ${s.border}`}>
                                <div className="text-[0.65rem] uppercase font-bold text-text-sec tracking-wider mb-2">{s.label}</div>
                                <div className={`font-mono text-3xl font-bold leading-none ${s.color}`}>{s.val}</div>
                            </div>
                        ))}
                    </div>

                    {/* Config Box */}
                    <div className="bg-bg-body border border-border rounded-xl p-5 mb-6">
                        <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
                            <span className="text-sm text-text-sec">{keys.length} llaves activas para tu perfil</span>
                            <div className="flex items-center gap-3 text-sm text-text-sec">
                                <label>Modelo:</label>
                                <select 
                                    value={selectedModel} 
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="bg-surface text-text-main border border-border rounded px-3 py-1.5 outline-none focus:border-primary"
                                >
                                    <option value="whisper-large-v3">Whisper Large V3 (Máx Calidad)</option>
                                    <option value="whisper-large-v3-turbo">Whisper Turbo (Rápido)</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-5 border-t border-border">
                            <div className="flex justify-between items-center mb-2">
                                <label className="font-semibold text-sm">⚡ Transcripciones Simultáneas: <span className="text-primary">{maxConcurrency}</span></label>
                                <div className={`font-mono text-xs px-2.5 py-1 rounded border font-bold ${ramClass}`}>
                                    RAM Est: ~{estRam} GB
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-xs opacity-70">1</span>
                                <input 
                                    type="range" min="1" max="25" step="1" 
                                    value={maxConcurrency} 
                                    onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                                    className="flex-1 accent-primary cursor-pointer h-2 bg-surface-2 rounded-lg appearance-none"
                                />
                                <span className="text-xs opacity-70">25</span>
                            </div>
                        </div>
                    </div>

                    {/* Upload Area */}
                    <div className="relative bg-bg-body border-2 border-dashed border-border rounded-xl p-8 text-center mb-6 transition hover:border-primary hover:bg-surface-2 group">
                        <input 
                            type="file" multiple accept="audio/*" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={(e) => {
                                if(e.target.files) onFilesAdded(e.target.files);
                                e.target.value = ''; // reset
                            }}
                        />
                        <div className="text-4xl mb-3 text-primary group-hover:scale-110 transition">☁️</div>
                        <h2 className="font-bold text-lg mb-1">Cargar Audios Nuevos</h2>
                        <p className="text-text-sec text-sm">Arrastra aquí tus archivos WAV o MP3 Estéreo</p>
                    </div>

                    {/* Global Controls */}
                    <div className="flex gap-3 mb-6 flex-wrap">
                        <button 
                            onClick={onStart} 
                            disabled={keys.length === 0 || jobs.filter(j => j.status !== 'done').length === 0 || isProcessing}
                            className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-white transition transform hover:-translate-y-0.5
                                ${keys.length === 0 || jobs.filter(j => j.status !== 'done').length === 0 ? 'bg-surface-2 text-text-sec opacity-70 cursor-not-allowed' : 'bg-gradient-to-br from-primary to-[#d94026] hover:brightness-110 shadow-lg'}
                            `}
                        >
                           {isProcessing ? 'PROCESANDO...' : '▶ INICIAR PROCESO'}
                        </button>
                        
                        {isProcessing && (
                            <>
                                <button onClick={onPauseAll} className="flex-1 py-4 bg-gradient-to-br from-warning to-orange-700 text-white rounded-xl font-bold hover:brightness-110 shadow-lg">
                                    {globalPaused ? '▶ REANUDAR TODO' : '⏸ PAUSAR TODO'}
                                </button>
                                <button onClick={() => jobs.forEach(j => { if(j.status !== 'done') onCancelJob(j.id) })} className="flex-1 py-4 bg-gradient-to-br from-danger to-red-800 text-white rounded-xl font-bold hover:brightness-110 shadow-lg">
                                    ⏹ CANCELAR TODO
                                </button>
                            </>
                        )}

                        {/* Download All Button - Only visible if there are PENDING downloads */}
                        {pendingDownloadsCount > 0 && (
                            <button 
                                onClick={handleDownloadAll} 
                                className="flex-1 py-4 bg-gradient-to-br from-success to-emerald-700 text-white rounded-xl font-bold hover:brightness-110 shadow-lg flex items-center justify-center gap-2"
                                title="Descargar archivos pendientes"
                            >
                                <span dangerouslySetInnerHTML={{ __html: ICONS.download }} className="w-5 h-5" />
                                BAJAR TODO ({pendingDownloadsCount})
                            </button>
                        )}
                    </div>

                    <QueueTable 
                        jobs={jobs} 
                        currentUser={currentUser}
                        onPause={(id) => {
                            const job = jobs.find(j => j.id === id);
                            if(job) updateJob(id, { paused: !job.paused });
                        }}
                        onCancel={onCancelJob}
                        onDownload={(id, blob, name) => {
                            const url = URL.createObjectURL(blob!);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${name.split('.')[0]}_Stereo.doc`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            updateJob(id, { downloaded: true });
                        }}
                        onRetry={onRetryJob}
                    />
                </div>
            )}

            {tab === 'archive' && <HistoryArchive jobs={jobs} currentUser={currentUser} />}
            
            {tab === 'team' && <TeamStats currentUser={currentUser} />}

        </div>
    );
};

export default Dashboard;
