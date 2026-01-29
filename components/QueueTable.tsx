
import React from 'react';
import { Job, ICONS } from '../types';

interface Props {
    jobs: Job[];
    currentUser: string;
    onPause: (id: string) => void;
    onCancel: (id: string) => void;
    onDownload: (id: string, blob: Blob | undefined | null, name: string) => void;
    onRetry: (id: string) => void;
}

const QueueTable: React.FC<Props> = ({ jobs, currentUser, onPause, onCancel, onDownload, onRetry }) => {
    // Show only jobs for current user in Active tab, or filter within parent. 
    // Assuming parent passes filtered or we filter here. 
    // The requirement says "filterJobsByAgent" in original code.
    const myJobs = jobs.filter(j => j.agent === currentUser && j.status !== 'cancelled'); 
    // Sort: Active/Pending first, then Done
    const sorted = [...myJobs].sort((a,b) => b.timestamp - a.timestamp);

    // Split into active/pending list and finished list (like original Active tab)
    const activeList = sorted.filter(j => j.status !== 'done');
    const finishedList = sorted.filter(j => j.status === 'done');
    
    // Original code showed finished rows in the same table if they were "just finished" (loaded today).
    // We will render all in one table for simplicity but prioritize active at top.
    
    const displayList = [...activeList, ...finishedList];

    return (
        <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-surface-2 text-text-sec uppercase font-semibold text-xs">
                    <tr>
                        <th className="p-4 w-[5%]">#</th>
                        <th className="p-4 w-[30%]">Archivo</th>
                        <th className="p-4 w-[15%]">Key</th>
                        <th className="p-4 w-[35%]">Estado</th>
                        <th className="p-4 w-[15%] text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {displayList.map((job, idx) => {
                        const isDone = job.status === 'done';
                        const isError = job.status === 'error';
                        const isActive = job.status === 'active';
                        
                        let badgeClass = "bg-surface-2 text-text-sec border-border";
                        if(isActive) badgeClass = "bg-primary/15 text-primary animate-pulse-custom";
                        if(isDone) badgeClass = "bg-success/15 text-success border-success/20";
                        if(isError) badgeClass = "bg-danger/15 text-danger";

                        let progressColor = "bg-purple";
                        if(job.progress && job.progress > 80) progressColor = "bg-warning";
                        if(isDone) progressColor = "bg-success";

                        return (
                            <tr key={job.id} className="hover:bg-white/5 transition">
                                <td className="p-4">
                                    {isDone ? <span className="text-success text-lg">✔</span> : <span className="font-semibold text-text-sec">{idx + 1}</span>}
                                </td>
                                <td className="p-4">
                                    <div className="font-bold text-base">{job.fileName}</div>
                                    <div className="text-xs text-text-sec mt-1">{(job.fileSize ? job.fileSize/1024/1024 : 0).toFixed(2)} MB</div>
                                </td>
                                <td className="p-4">
                                    {job.assignedKey ? (
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className="px-2 py-1 rounded-full text-xs font-mono bg-[#422006] text-[#fde047] border border-border">
                                                🔑 {job.assignedKey.owner} #{job.assignedKey.id}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="opacity-50">-</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${badgeClass}`}>
                                        {job.paused ? 'Pausado' : (isDone ? 'Finalizado' : (isActive ? 'Procesando' : job.status))}
                                    </span>
                                    
                                    {(isActive || job.status === 'pending' || isDone) && (
                                        <div className="h-3 bg-surface-2 w-full rounded-md mt-2 overflow-hidden border border-border relative">
                                            <div 
                                                className={`h-full transition-all duration-500 progress-stripes ${progressColor}`} 
                                                style={{ width: `${job.progress || 0}%` }}
                                            />
                                        </div>
                                    )}
                                    <div className="text-xs text-text-sec mt-1 font-mono flex justify-between">
                                        <span>{job.statusText || 'En espera...'}</span>
                                        {isDone && <span className="text-success">Listo</span>}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex justify-end gap-2 items-center">
                                        {isActive && (
                                            <>
                                                <button 
                                                    onClick={() => onPause(job.id)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-surface text-text-sec hover:text-primary hover:border-primary hover:bg-surface-2 transition"
                                                    dangerouslySetInnerHTML={{ __html: job.paused ? ICONS.play : ICONS.pause }}
                                                />
                                                <button 
                                                    onClick={() => onCancel(job.id)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-surface text-text-sec hover:text-danger hover:border-danger hover:bg-surface-2 transition"
                                                    dangerouslySetInnerHTML={{ __html: ICONS.stop }}
                                                />
                                            </>
                                        )}
                                        
                                        {isError && (
                                            <button 
                                                onClick={() => onRetry(job.id)}
                                                className="px-3 py-1.5 bg-warning text-black font-bold text-xs rounded shadow hover:brightness-110 flex items-center gap-1"
                                            >
                                                <span dangerouslySetInnerHTML={{__html: ICONS.retry}} /> Reintentar
                                            </button>
                                        )}

                                        {(isDone || isActive) && (
                                            <button 
                                                disabled={!isDone || job.downloaded}
                                                onClick={() => onDownload(job.id, job.docBlob, job.fileName)}
                                                className={`
                                                    px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition shadow-sm
                                                    ${(isDone && !job.downloaded) ? 'bg-success text-white cursor-pointer hover:-translate-y-0.5 hover:brightness-110' : 'bg-surface-2 text-text-sec opacity-50 cursor-not-allowed border border-border shadow-none'}
                                                `}
                                            >
                                                <span dangerouslySetInnerHTML={{ __html: job.downloaded ? ICONS.check : ICONS.download }} />
                                                DOC
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default QueueTable;
