import React from 'react';
import { Job, ICONS } from '../types';

interface Props {
    jobs: Job[];
    currentUser: string;
}

const HistoryArchive: React.FC<Props> = ({ jobs, currentUser }) => {
    // Filter out today's jobs, keep only user's jobs
    const todayStr = new Date().toLocaleDateString();
    const archiveJobs = jobs.filter(j => {
        const d = new Date(j.timestamp).toLocaleDateString();
        return j.agent === currentUser && d !== todayStr;
    }).sort((a,b) => b.timestamp - a.timestamp);

    const download = (job: Job) => {
        if(job.docBlob) {
            const url = URL.createObjectURL(job.docBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${job.fileName.split('.')[0]}_Stereo.doc`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert("Documento no disponible en caché local.");
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-surface-2 p-8 rounded-xl text-center mb-6">
                <h3 className="text-lg font-bold mb-1">🗄️ Archivo Histórico Personal</h3>
                <p className="text-text-sec text-sm">Tus trabajos anteriores.</p>
            </div>

            <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-surface-2 text-text-sec uppercase font-semibold text-xs">
                        <tr>
                            <th className="p-4">Fecha</th>
                            <th className="p-4">Archivo</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4 text-right">Recuperar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {archiveJobs.map(job => (
                            <tr key={job.id} className="hover:bg-white/5">
                                <td className="p-4 font-semibold">{new Date(job.timestamp).toLocaleDateString()}</td>
                                <td className="p-4 font-bold">{job.fileName}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${job.status === 'done' ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger'}`}>
                                        {job.status}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    {job.status === 'done' && (
                                        <button onClick={() => download(job)} className="text-success hover:underline flex items-center justify-end gap-1 w-full font-bold text-xs">
                                            <span dangerouslySetInnerHTML={{ __html: ICONS.download }} className="w-4 h-4" /> DESCARGAR
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {archiveJobs.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-text-sec">No hay historial antiguo.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default HistoryArchive;