import React, { useState } from 'react';
import { Job, ICONS } from '../types';

interface Props {
    jobs: Job[];
    onClose: () => void;
    onDownload: (job: Job) => void;
}

const DownloadSelectionModal: React.FC<Props> = ({ jobs, onClose, onDownload }) => {
    // Filter only jobs that are done and have a docBlob
    const downloadableJobs = jobs.filter(j => j.status === 'done' && j.docBlob);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === downloadableJobs.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(downloadableJobs.map(j => j.id));
        }
    };

    const handleDownloadSelected = async () => {
        const selectedJobs = downloadableJobs.filter(j => selectedIds.includes(j.id));
        
        for (const job of selectedJobs) {
            onDownload(job);
            // Small delay to prevent browser blocking multiple downloads
            await new Promise(r => setTimeout(r, 500));
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center bg-surface-2/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                            <span dangerouslySetInnerHTML={{ __html: ICONS.download }} className="w-6 h-6" />
                            Descarga Selectiva
                        </h2>
                        <p className="text-sm text-text-sec mt-1">Selecciona los archivos que deseas descargar nuevamente.</p>
                    </div>
                    <button onClick={onClose} className="text-text-sec hover:text-white transition text-2xl leading-none">&times;</button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {downloadableJobs.length === 0 ? (
                        <div className="text-center py-12 text-text-sec">
                            <p>No hay archivos procesados disponibles para descargar.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-surface z-10 text-xs uppercase text-text-sec font-bold">
                                <tr>
                                    <th className="p-3 border-b border-border w-10">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.length === downloadableJobs.length && downloadableJobs.length > 0}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 accent-primary cursor-pointer rounded"
                                        />
                                    </th>
                                    <th className="p-3 border-b border-border">Archivo</th>
                                    <th className="p-3 border-b border-border text-right">Duración</th>
                                    <th className="p-3 border-b border-border text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {downloadableJobs.map(job => (
                                    <tr 
                                        key={job.id} 
                                        className={`border-b border-border/50 hover:bg-white/5 transition cursor-pointer ${selectedIds.includes(job.id) ? 'bg-primary/10' : ''}`}
                                        onClick={() => toggleSelection(job.id)}
                                    >
                                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.includes(job.id)}
                                                onChange={() => toggleSelection(job.id)}
                                                className="w-4 h-4 accent-primary cursor-pointer rounded"
                                            />
                                        </td>
                                        <td className="p-3 font-medium text-text-main">
                                            {job.fileName}
                                            <div className="text-xs text-text-sec font-mono">{new Date(job.timestamp).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="p-3 text-right font-mono text-sm text-text-sec">
                                            {job.duration ? (job.duration / 60).toFixed(1) + ' min' : '--'}
                                        </td>
                                        <td className="p-3 text-center">
                                            {job.downloaded ? (
                                                <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded border border-success/30">Descargado</span>
                                            ) : (
                                                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded border border-warning/30">Pendiente</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-surface-2/30 rounded-b-2xl flex justify-between items-center">
                    <div className="text-sm text-text-sec">
                        {selectedIds.length} seleccionados
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg font-medium text-text-sec hover:bg-white/5 transition"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleDownloadSelected}
                            disabled={selectedIds.length === 0}
                            className={`px-6 py-2 rounded-lg font-bold text-white transition shadow-lg flex items-center gap-2
                                ${selectedIds.length === 0 ? 'bg-surface-2 text-text-sec opacity-50 cursor-not-allowed' : 'bg-primary hover:brightness-110'}
                            `}
                        >
                            <span dangerouslySetInnerHTML={{ __html: ICONS.download }} className="w-4 h-4" />
                            Descargar ({selectedIds.length})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DownloadSelectionModal;
